# Hướng dẫn sử dụng — AI Live Translator & Smart Answer Assistant

**Phiên bản:** 1.0  
**Hệ điều hành:** Windows 10 & Windows 11 (64-bit)  
**Chiến lược:** 100% Local First — Bảo mật tuyệt đối — Không lưu trữ âm thanh

---

## 1. Giới thiệu tổng quan

**AI Live Translator & Smart Answer Assistant** là ứng dụng Windows chuyên dụng hỗ trợ bạn hiểu và giao tiếp bằng tiếng Anh trong thời gian thực:
- **Nghe âm thanh hệ thống qua tai nghe:** Tự động thu âm thanh từ các cuộc họp Zoom, Google Meet, Microsoft Teams, video YouTube, podcast hoặc khóa học mà không cần cài thêm microphone ảo (như VoiceMeeter).
- **Phụ đề song ngữ nổi (Subtitle Overlay):** Hiển thị câu tiếng Anh gốc phía trên và bản dịch tiếng Việt màu vàng nổi bật ngay phía dưới. Cửa sổ phụ đề luôn nổi trên các ứng dụng khác và có thể kéo thả linh hoạt.
- **Trợ lý câu trả lời thông minh (Smart Answer Assistant):** Tự động phát hiện khi có câu hỏi phỏng vấn hoặc câu hỏi trong cuộc họp hướng đến bạn, gợi ý sẵn 3 phong cách trả lời (Chuyên nghiệp, Ngắn gọn, Thân thiện) có kèm bản dịch tiếng Việt để bạn tự tin phản hồi ngay lập tức.
- **Tối ưu tiếng Anh Ấn Độ (Indian English):** Bộ từ điển chuẩn hóa tự động dịch đúng các thành ngữ và cách diễn đạt đặc trưng trong môi trường IT toàn cầu (ví dụ: *prepone*, *do the needful*, *revert back*, *k8s*, *PR*...).

---

## 2. Hướng dẫn khởi chạy ứng dụng

### Chạy trực tiếp từ thư mục Release:
File thực thi nằm tại:
`src-tauri\target\release\ai-live-translator.exe`

Hoặc chạy chế độ phát triển:
```powershell
cd ai-live-translator
pnpm dev    # Chạy giao diện React Vite
```

---

## 3. Các chức năng chính

### 3.1. Thu âm thanh hệ thống (WASAPI Loopback)
1. Trên màn hình **Dashboard**, bạn sẽ thấy danh sách thiết bị đầu ra trong mục **Windows Output Audio Device**.
2. Ứng dụng tự động chọn thiết bị mặc định (**Default Playback Device** — ví dụ: Tai nghe Bluetooth, Tai nghe có dây 3.5mm hoặc Loa Realtek).
3. Nhấn nút lớn **Start Listening** màu chàm:
   - Nút chuyển sang màu đỏ **Stop Listening**.
   - Thanh tín hiệu **PCM Signal Level** sẽ chuyển động theo âm lượng thực tế của video/cuộc họp (hiển thị đơn vị dBFS thời gian thực).
4. Nhấn **Stop Listening** bất kỳ lúc nào để ngắt hoàn toàn tiến trình thu âm.

### 3.2. Cửa sổ phụ đề nổi (Subtitle Overlay)
- Cửa sổ phụ đề được thiết kế theo phong cách kính mờ hiện đại (*glassmorphism*), luôn nổi trên cửa sổ ứng dụng họp hoặc trình duyệt.
- **Kéo thả:** Bấm giữ và kéo thanh trên cùng để di chuyển phụ đề đến bất kỳ vị trí thuận tiện nào trên màn hình.
- **Thu gọn:** Bấm nút dấu trừ `_` ở góc phải trên để thu nhỏ thành một thanh icon gọn gàng khi không cần xem nhiều. Bấm lại để mở rộng.
- **Phụ đề song ngữ:**
  - Dòng trên: Câu tiếng Anh (chữ nghiêng khi đang nhận diện, chữ đậm khi đã xác nhận).
  - Dòng dưới: Bản dịch tiếng Việt chuẩn ngữ cảnh IT.

### 3.3. Trợ lý gợi ý câu trả lời (Smart Answer Assistant)
Khi đối tác hoặc người phỏng vấn đặt câu hỏi:
1. Hệ thống tự động nhận diện câu hỏi và hiển thị nhãn độ tin cậy.
2. Tại tab **Smart Answer**, 3 phong cách câu trả lời được chuẩn bị sẵn:
   - **Professional (Chuyên nghiệp):** Lập luận chặt chẽ, cấu trúc mở - thân - kết phù hợp buổi họp trang trọng.
   - **Concise (Ngắn gọn):** Đi thẳng vào trọng tâm, tiết kiệm thời gian.
   - **Friendly (Thân thiện):** Giọng điệu cởi mở, tự nhiên.
3. Bấm **Copy English** để sao chép câu trả lời vào clipboard.
4. **Quy tắc chống tự bịa (Anti-Fabrication Guard):** Ứng dụng không bao giờ tự bịa kinh nghiệm cá nhân của bạn. Những chỗ cần số liệu hoặc công nghệ cụ thể của bạn sẽ có dấu ngoặc vuông `[mô tả kinh nghiệm / công nghệ]`, bạn chỉ việc điền đúng thông tin thực tế của mình.
5. **Gợi ý thủ công:** Nếu âm thanh bị nhiễu hoặc bạn muốn chủ động hỏi phương án trả lời, hãy nhập hoặc dán nội dung vào ô tìm kiếm ở trên cùng và bấm **Suggest Answer**.

### 3.4. Cài đặt mô hình AI & Quyền riêng tư (Settings)
Tại tab **Settings & Audio**:
- **STT Model Selection:**
  - `Tiny (39 MB)`: Siêu nhẹ, phản hồi cực nhanh, tiết kiệm pin máy tính.
  - `Base (74 MB)`: Khuyên dùng. Cân bằng tối ưu giữa tốc độ và độ chuẩn xác với giọng Ấn Độ. Đã được tải sẵn trong máy (`models/ggml-tiny.en.bin`).
  - `Small (244 MB)`: Độ chuẩn xác cao nhất, khai thác tối đa card đồ họa NVIDIA RTX 3050.
- **Chính sách riêng tư:**
  - Dữ liệu âm thanh hoàn toàn chỉ nằm trong RAM và bị xóa ngay sau khi chuyển thành văn bản.
  - Không ghi bất kỳ file âm thanh nào xuống ổ cứng.
  - Nút **Clear History** cho phép xóa sạch toàn bộ lịch sử phụ đề và câu hỏi của phiên làm việc chỉ với 1 cú click.

---

## 4. Xử lý sự cố thường gặp (Troubleshooting)

| Tình huống | Nguyên nhân | Cách xử lý |
|------------|-------------|------------|
| Thanh âm lượng dBFS đứng yên | Chưa có âm thanh phát trên máy hoặc âm lượng quá nhỏ | Bật video/âm thanh và kiểm tra âm lượng Windows |
| Đổi từ loa ngoài sang tai nghe Bluetooth | Windows đổi thiết bị đầu ra mặc định | Bấm Stop Listening rồi bấm Start Listening lại để ứng dụng nhận thiết bị mới |
| Phụ đề bị khuất sau game/ứng dụng Fullscreen | Ứng dụng kia đang ở chế độ Exclusive Fullscreen | Chuyển ứng dụng đó sang chế độ *Borderless Windowed* |
| Cần xóa sạch lịch sử hội thoại | Bảo mật riêng tư sau phỏng vấn | Vào **Settings** → Bấm **Clear History** |
