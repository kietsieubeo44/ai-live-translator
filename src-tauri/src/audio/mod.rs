// Audio Capture Module
// Implements AudioCaptureProvider using WASAPI loopback

use anyhow::{anyhow, Context, Result};
use crossbeam_channel::{bounded, Receiver, Sender};
use log::{error, info};
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::thread;
use std::time::Duration;

use windows::{
    core::*,
    Win32::Media::Audio::*,
    Win32::Media::Audio::Endpoints::*,
    Win32::System::Com::*,
    Win32::System::Com::StructuredStorage::*,
    Win32::UI::Shell::PropertiesSystem::*,
    Win32::Devices::Properties::*,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AudioDevice {
    pub id: String,
    pub name: String,
    pub is_default: bool,
    pub channels: u16,
    pub sample_rate: u32,
    pub bits_per_sample: u16,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptureStatus {
    pub is_capturing: bool,
    pub device_name: Option<String>,
    pub rms: f32,
    pub sample_rate: u32,
    pub channels: u16,
}

pub enum AudioMessage {
    PcmChunk { samples: Vec<f32>, rms: f32, sample_rate: u32, channels: u16 },
    LevelUpdate(f32),
    Error(String),
    DeviceDisconnected,
    Stopped,
}

struct ComInitGuard;
impl ComInitGuard {
    fn new() -> Result<Self> {
        unsafe {
            CoInitializeEx(None, COINIT_MULTITHREADED).ok().context("COM init failed")?;
        }
        Ok(ComInitGuard)
    }
}
impl Drop for ComInitGuard {
    fn drop(&mut self) { unsafe { CoUninitialize() }; }
}

pub fn list_audio_devices() -> Result<Vec<AudioDevice>> {
    let _com = ComInitGuard::new()?;
    unsafe {
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;

        let default_device = enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?;
        let default_id = match default_device.GetId() {
            Ok(pwstr) => pwstr.to_string().unwrap_or_default(),
            Err(_) => String::new(),
        };

        let collection = enumerator.EnumAudioEndpoints(eRender, DEVICE_STATE_ACTIVE)?;
        let count = collection.GetCount()?;
        let mut devices = Vec::new();

        for i in 0..count {
            let device = match collection.Item(i) {
                Ok(d) => d,
                Err(_) => continue,
            };

            let id = match device.GetId() {
                Ok(pwstr) => pwstr.to_string().unwrap_or_else(|_| format!("device-{}", i)),
                Err(_) => format!("device-{}", i),
            };

            let prop_store = match device.OpenPropertyStore(STGM_READ) {
                Ok(ps) => ps,
                Err(_) => {
                    devices.push(AudioDevice {
                        is_default: id == default_id,
                        id: id.clone(),
                        name: format!("Device {}", i),
                        channels: 2,
                        sample_rate: 48000,
                        bits_per_sample: 32,
                    });
                    continue;
                }
            };

            let name = get_device_name(&prop_store).unwrap_or_else(|_| format!("Device {}", i));
            let (channels, sample_rate, bits) = get_device_format(&device).unwrap_or((2, 48000, 32));

            devices.push(AudioDevice {
                is_default: id == default_id,
                id,
                name,
                channels,
                sample_rate,
                bits_per_sample: bits,
            });
        }
        Ok(devices)
    }
}

unsafe fn get_device_name(prop_store: &IPropertyStore) -> Result<String> {
    let key = PROPERTYKEY {
        fmtid: GUID::from_values(
            0xa45c254e, 0xdf1c, 0x4efd,
            [0x80, 0x20, 0x67, 0xd1, 0x46, 0xa8, 0x50, 0xe0],
        ),
        pid: 14,
    };
    let prop = prop_store.GetValue(&key)?;
    let name = prop.to_string();
    if name.is_empty() || name == "VT_EMPTY" {
        return Ok("Unknown Device".to_string());
    }
    Ok(name)
}

unsafe fn get_device_format(device: &IMMDevice) -> Result<(u16, u32, u16)> {
    let audio_client: IAudioClient = device.Activate(CLSCTX_ALL, None)?;
    let mix_format = audio_client.GetMixFormat()?;
    let fmt = &*mix_format;
    let result = (fmt.nChannels, fmt.nSamplesPerSec, fmt.wBitsPerSample);
    CoTaskMemFree(Some(mix_format as *const _ as *const _));
    Ok(result)
}

pub struct WasapiCaptureManager {
    is_running: Arc<AtomicBool>,
    current_device: Option<AudioDevice>,
    audio_sender: Option<Sender<AudioMessage>>,
}

impl WasapiCaptureManager {
    pub fn new() -> Self {
        WasapiCaptureManager {
            is_running: Arc::new(AtomicBool::new(false)),
            current_device: None,
            audio_sender: None,
        }
    }

    pub fn start(&mut self, device_id: &str) -> Result<Receiver<AudioMessage>> {
        if self.is_running.load(Ordering::SeqCst) {
            return Err(anyhow!("Capture already running"));
        }

        let devices = list_audio_devices()?;
        let device = devices
            .into_iter()
            .find(|d| d.id == device_id || (device_id == "default" && d.is_default))
            .ok_or_else(|| anyhow!("Device not found: {}", device_id))?;

        self.current_device = Some(device.clone());
        self.is_running.store(true, Ordering::SeqCst);

        let (tx, rx) = bounded::<AudioMessage>(512);
        self.audio_sender = Some(tx.clone());

        let is_running = Arc::clone(&self.is_running);
        let dev_id = device.id.clone();

        thread::spawn(move || {
            info!("Capture thread started: {}", dev_id);
            if let Err(e) = wasapi_capture_loop(&dev_id, &is_running, &tx) {
                error!("Capture error: {}", e);
                let _ = tx.send(AudioMessage::Error(e.to_string()));
            }
            let _ = tx.send(AudioMessage::Stopped);
            info!("Capture thread ended");
        });

        Ok(rx)
    }

    pub fn stop(&mut self) {
        self.is_running.store(false, Ordering::SeqCst);
        self.current_device = None;
    }

    pub fn get_status(&self) -> CaptureStatus {
        CaptureStatus {
            is_capturing: self.is_running.load(Ordering::SeqCst),
            device_name: self.current_device.as_ref().map(|d| d.name.clone()),
            rms: 0.0,
            sample_rate: self.current_device.as_ref().map(|d| d.sample_rate).unwrap_or(0),
            channels: self.current_device.as_ref().map(|d| d.channels).unwrap_or(0),
        }
    }
}

fn wasapi_capture_loop(
    device_id: &str,
    is_running: &AtomicBool,
    sender: &Sender<AudioMessage>,
) -> Result<()> {
    let _com = ComInitGuard::new()?;

    unsafe {
        let enumerator: IMMDeviceEnumerator =
            CoCreateInstance(&MMDeviceEnumerator, None, CLSCTX_ALL)?;

        let device = if device_id == "default" {
            enumerator.GetDefaultAudioEndpoint(eRender, eConsole)?
        } else {
            let id_wide: Vec<u16> = device_id.encode_utf16().chain(std::iter::once(0)).collect();
            enumerator.GetDevice(PCWSTR(id_wide.as_ptr()))?
        };

        let audio_client: IAudioClient = device.Activate(CLSCTX_ALL, None)?;
        let mix_format_ptr = audio_client.GetMixFormat()?;
        let mix_format = &*mix_format_ptr;

        let channels = mix_format.nChannels;
        let sample_rate = mix_format.nSamplesPerSec;
        let bits_per_sample = mix_format.wBitsPerSample;

        audio_client.Initialize(
            AUDCLNT_SHAREMODE_SHARED,
            AUDCLNT_STREAMFLAGS_LOOPBACK,
            10_000_000,
            0,
            mix_format_ptr,
            None,
        )?;

        let capture_client: IAudioCaptureClient = audio_client.GetService()?;
        audio_client.Start()?;
        info!("WASAPI loopback started: {}ch {}Hz {}bit", channels, sample_rate, bits_per_sample);

        while is_running.load(Ordering::SeqCst) {
            let packet_size = match capture_client.GetNextPacketSize() {
                Ok(s) => s,
                Err(e) => {
                    if e.code().0 == AUDCLNT_E_DEVICE_INVALIDATED.0 as i32 {
                        let _ = sender.send(AudioMessage::DeviceDisconnected);
                        break;
                    }
                    return Err(e.into());
                }
            };

            if packet_size == 0 {
                thread::sleep(Duration::from_millis(5));
                continue;
            }

            let mut data_ptr: *mut u8 = std::ptr::null_mut();
            let mut frames_available: u32 = 0;
            let mut flags: u32 = 0;

            capture_client.GetBuffer(&mut data_ptr, &mut frames_available, &mut flags, None, None)?;

            if frames_available == 0 {
                capture_client.ReleaseBuffer(frames_available).ok();
                continue;
            }

            let is_silent = (flags & 0x2) != 0;
            let samples = if is_silent || data_ptr.is_null() {
                vec![0.0f32; (frames_available * channels as u32) as usize]
            } else {
                let bytes = (frames_available as usize) * (channels as usize) * (bits_per_sample / 8) as usize;
                let raw = std::slice::from_raw_parts(data_ptr, bytes);
                convert_to_f32(raw, bits_per_sample, channels, frames_available, mix_format)
            };

            capture_client.ReleaseBuffer(frames_available).ok();

            let rms = compute_rms(&samples);

            if sender.send(AudioMessage::PcmChunk {
                samples,
                rms,
                sample_rate,
                channels,
            }).is_err() {
                break;
            }
        }

        audio_client.Stop().ok();
        CoTaskMemFree(Some(mix_format_ptr as *const _ as *const _));
        Ok(())
    }
}

unsafe fn convert_to_f32(raw: &[u8], bits: u16, channels: u16, frames: u32, fmt: &WAVEFORMATEX) -> Vec<f32> {
    let total = (frames as usize) * (channels as usize);
    let is_float = fmt.wFormatTag == 3 || (fmt.wFormatTag == 0xFFFE && bits == 32);

    if is_float && bits == 32 {
        std::slice::from_raw_parts(raw.as_ptr() as *const f32, total).to_vec()
    } else if bits == 16 {
        std::slice::from_raw_parts(raw.as_ptr() as *const i16, total)
            .iter().map(|&s| s as f32 / 32768.0).collect()
    } else if bits == 32 {
        std::slice::from_raw_parts(raw.as_ptr() as *const i32, total)
            .iter().map(|&s| s as f32 / 2147483648.0).collect()
    } else {
        vec![0.0f32; total]
    }
}

pub fn compute_rms(samples: &[f32]) -> f32 {
    if samples.is_empty() { return 0.0; }
    let sum: f32 = samples.iter().map(|&s| s * s).sum();
    (sum / samples.len() as f32).sqrt()
}

pub fn resample_for_stt(samples: &[f32], src_rate: u32, src_channels: u16) -> Vec<f32> {
    let mono: Vec<f32> = if src_channels == 1 {
        samples.to_vec()
    } else {
        samples
            .chunks(src_channels as usize)
            .map(|frame| frame.iter().sum::<f32>() / src_channels as f32)
            .collect()
    };

    let target_rate = 16000u32;
    if src_rate == target_rate {
        return mono;
    }

    let ratio = src_rate as f64 / target_rate as f64;
    let output_len = ((mono.len() as f64 / ratio).ceil() as usize).max(1);
    let mut output = Vec::with_capacity(output_len);

    for i in 0..output_len {
        let src_idx = i as f64 * ratio;
        let idx = src_idx as usize;
        let frac = src_idx - idx as f64;

        let s0 = mono.get(idx).copied().unwrap_or(0.0);
        let s1 = mono.get(idx + 1).copied().unwrap_or(s0);
        output.push(s0 + (s1 - s0) * frac as f32);
    }

    output
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_rms_silence() {
        assert_eq!(compute_rms(&[0.0; 1024]), 0.0);
    }

    #[test]
    fn test_rms_sine() {
        let samples: Vec<f32> = (0..1024)
            .map(|i| (2.0 * std::f32::consts::PI * 440.0 * i as f32 / 44100.0).sin() * 0.5)
            .collect();
        let rms = compute_rms(&samples);
        assert!(rms > 0.3 && rms < 0.4, "Got {}", rms);
    }

    #[test]
    fn test_resample_stereo_to_mono() {
        let stereo = vec![0.5f32, 0.5, 0.8, 0.8];
        let mono = resample_for_stt(&stereo, 48000, 2);
        assert_eq!(mono[0], 0.5, "Channel mix should average to 0.5");
    }

    #[test]
    fn test_resample_rate_change() {
        let input = vec![0.1f32; 4800];
        let output = resample_for_stt(&input, 48000, 1);
        assert!((output.len() as i32 - 1600).abs() < 5, "Got {} samples", output.len());
    }

    #[test]
    fn test_list_devices_no_panic() {
        let _ = list_audio_devices();
    }
}
