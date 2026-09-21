# Durian Online

Phiên bản chơi online realtime của board game **Durian** (Oink Games), 2–7 người chơi.

- **client/**: React + Vite + Framer Motion. Có animation chia bài, rút và lật thẻ, rung chuông, token bay, confetti. Âm thanh được tổng hợp bằng Web Audio. Deploy lên **Vercel**.
- **server/**: Node + Express + Socket.IO. Server giữ trạng thái game, kiểm tra luật và gửi cho mỗi người một góc nhìn riêng (bạn không thấy thẻ của chính mình). Deploy lên **Render**.
- **shared/**: kiểu dữ liệu và bộ bài dùng chung cho client và server.

## Chạy ở máy

```bash
npm install && npm run install:all
npm run dev          # server :3210 + client :5173
```

Mở http://localhost:5173 rồi tạo phòng. Mở thêm tab để vào cùng phòng (mỗi tab là một người chơi), hoặc bấm **+ Thêm bot** trong phòng chờ.

Chạy test luật chơi:

```bash
npm test
```

## Chat

- Mỗi phòng có chat realtime: ở phòng chờ và ở thanh bên khi đang chơi (tab Chat / Nhật ký). Trên điện thoại, chat nằm trong nút 💬 và có số tin chưa đọc.
- Tin nhắn hiện thành bong bóng lời nói trên đầu người gửi. Các emoji nhanh (😂 😱 😡 …) bay lên từ ghế của họ.
- Mỗi người được gửi tối đa 5 tin trong 5 giây. Người vào phòng sau sẽ thấy 80 tin gần nhất.

## Bot

Chủ phòng có thể thêm bot vào các ghế trống trong phòng chờ, và mời bot ra bằng nút ✕. Bot chạy trên server và chỉ biết những gì một người ngồi ghế đó được thấy: thẻ của mọi người trừ thẻ của chính nó, không biết chồng bài. Mỗi lượt, bot:

- tính xác suất tổng đơn vượt kho, dựa trên mọi khả năng của lá bài nó không thấy;
- rung chuông khi xác suất đủ cao (mỗi lượt có một chút ngẫu nhiên để bot không quá máy móc);
- khi nhận đơn hoặc lật đơn bằng khỉ đột, chọn phương án ít rủi ro nhất.

## Deploy

### 1. Server lên Render

1. Push repo lên GitHub.
2. Trên Render, chọn **New → Blueprint**, trỏ vào repo. Render sẽ đọc file `render.yaml`.
   Nếu tạo Web Service thủ công thì dùng:
   - Build: `npm install --prefix server && npm run build --prefix server`
   - Start: `node server/dist/index.js`
   - Health check: `/health`
3. Đặt biến môi trường `CLIENT_ORIGIN` bằng URL Vercel, ví dụ `https://durian.vercel.app` (nhiều URL thì ngăn cách bằng dấu phẩy). Để trống nghĩa là cho phép mọi origin.

### 2. Client lên Vercel

1. Import repo trên Vercel, **để Root Directory là thư mục gốc của repo**. File `vercel.json` đã khai báo sẵn lệnh build và thư mục output.
2. Thêm biến môi trường `VITE_SERVER_URL` bằng URL của Render, ví dụ `https://durian-server.onrender.com`.
3. Deploy.

### Cách khác: chỉ dùng Render

Nếu có `client/dist`, server sẽ tự phục vụ luôn client. Khi đó chỉ cần một service với:

- Build: `npm install --prefix server && npm install --prefix client && npm run build --prefix server && npm run build --prefix client`
- Start: `node server/dist/index.js`

Không cần đặt `VITE_SERVER_URL`.

### Lưu ý

- Gói free của Render sẽ ngủ sau khoảng 15 phút không dùng. Lần vào đầu tiên có thể mất 30–60 giây để server khởi động (trang chủ có hiện thông báo).
- Phòng chơi chỉ lưu trong bộ nhớ, nên server khởi động lại thì mọi phòng đang chơi sẽ mất.
- Tải lại trang không làm mất ghế, vì phiên chơi được lưu theo từng tab. Nếu một người mất kết nối giữa ván, chủ phòng có thể mời họ ra và vòng hiện tại sẽ được chia lại.

## Luật và bộ bài

Luật được cài đặt theo sách luật trong `Durian Rulebook _ RulesPal.html`. Oink Games chưa công bố danh sách chính xác 28 thẻ trái cây. Bộ bài trong `shared/deck.ts` được dựng theo các quy tắc trong sách luật:

- Mỗi thẻ có 2 loại trái khác nhau, một nửa có 1 trái và nửa kia có 2–3 trái.
- Dâu xuất hiện nhiều nhất, sầu riêng ít nhất.

Nếu có danh sách thẻ thật thì chỉ cần sửa `FRUIT_CARD_SPECS` trong file đó.

Hình ảnh gốc nằm ở `images/`. Chạy `npm run images` để tạo lại bản WebP đã tối ưu vào `client/public/assets/`.
