---
name: maintain-fe
description: Bảo trì hoặc khảo sát bản frontend Vite/React cũ trong fe/ của Đi Đâu Việt Nam khi người dùng yêu cầu rõ phần fe. Không dùng cho giao diện Next.js hiện hành trong web/.
---

# Làm việc với frontend cũ `fe/`

`fe/` là demo Vite + React 18 chạy ở cổng 5173. Giao diện sản phẩm hiện hành nằm trong `web/`; chỉ sửa `fe/` khi yêu cầu nhắc tới nó hoặc tới demo cũ.

## Những điểm cần biết

- `fe/src/App.tsx` giữ state tìm kiếm, lọc, vị trí và danh sách địa điểm. `fe/src/MapView.tsx` dựng bản đồ; `fe/src/types.ts` mô tả kiểu dữ liệu cũ.
- `fe/src/api.ts` gọi `/api/meta`, `/api/places` và `/api/random`; Vite proxy `/api` tới cổng 4000 theo `fe/vite.config.ts`. Backend hiện tại không còn hai endpoint `/api/places` và `/api/random`, nên demo không hoạt động đầy đủ với `be/` hiện hành. Đừng coi lỗi này là lỗi của luồng Next.js.
- `VITE_MAPBOX_TOKEN` trong `fe/.env.example` là token công khai cho bản đồ. Không đặt server key hay mật khẩu vào biến `VITE_*`.

Nếu nhiệm vụ là khôi phục demo, xác định hợp đồng API mong muốn rồi sửa adapter ở `fe/src/api.ts` và các kiểu/điểm gọi liên quan; không giả định response của API mới giống API cũ. Nếu nhiệm vụ là tính năng sản phẩm hiện hành, dùng `web/` theo [kiến trúc](../../docs/ARCHITECTURE.md).

Kiểm tra thay đổi trong `fe/` bằng `npm --prefix fe run build` (bao gồm TypeScript và Vite build). Script kiểm tra ở root không bao gồm `fe/`.
