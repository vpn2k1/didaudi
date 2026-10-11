---
name: curate-places
description: Biên tập hoặc rà soát dữ liệu địa điểm, tọa độ và ảnh của Đi Đâu Việt Nam trong be/data. Dùng khi thêm, sửa, xác minh hay gắn ảnh địa điểm; không dùng cho thay đổi giao diện hoặc logic API thông thường.
---

# Biên tập dữ liệu địa điểm

Đọc [README](../../README.md) phần dữ liệu minh họa và [kiến trúc](../../docs/ARCHITECTURE.md) trước khi sửa. Nguồn runtime hiện tại là `be/data/places.json`, `provinces.json`, `taxonomy.json` và `photos.json`; `be/data/place-sources.json` ghi nguồn biên tập riêng.

## Khi thêm hoặc sửa địa điểm

1. Đối chiếu cấu trúc với `be/src/domain/schemas.ts`. Dùng `provinceSlug` có trong `provinces.json`, `category` và `tags` có trong `taxonomy.json`; giữ `id` và `slug` ổn định khi sửa bản ghi cũ.
2. Chỉ điền giá chính xác, giờ mở cửa, trạng thái `verified` hoặc `isDemo=false` khi nguồn kiểm chứng thực sự hỗ trợ. `coordinates_checked` chỉ nói tọa độ đã đối chiếu, không đồng nghĩa xác minh thực địa. `priceLevel` là ước tính và phải tiếp tục được trình bày là ước tính.
3. Với ảnh, giữ `author`, `license`, `pageUrl`, `source` và `match`. Ảnh `topic` minh họa món/chủ đề, không được mô tả là ảnh của quán. Giữ `locked: true` đối với ảnh đã được duyệt.
   Với địa danh tỉnh, đối chiếu ảnh có đúng địa danh trước khi đặt `match: place`; trang Wikipedia của tỉnh hoặc ảnh logo không đủ căn cứ. Ghi URL nguồn địa danh, tọa độ và ảnh vào `place-sources.json`.
4. Kiểm tra `npm --prefix be run typecheck` và `npm --prefix be test`. Khi thay đổi có ảnh hưởng cách hiển thị hoặc SEO, chạy thêm kiểm tra web tương ứng trong [AGENTS.md](../../AGENTS.md).

## Đối chiếu bằng script

- `npm --prefix be run verify -- --province=<slug>` gọi OpenStreetMap và chỉ in báo cáo. Xem từng kết quả để loại khớp nhầm trước khi dùng `npm --prefix be run verify:apply -- --ids=<id1,id2>`; chế độ `--apply` ghi lại `places.json`.
- `node be/scripts/fetch-photos.mjs --only=<id1,id2>` gọi Wikimedia Commons và ghi `photos.json`. Xem lại ảnh, giấy phép và kiểu `place`/`topic` sau khi chạy. `--force` lấy lại các ảnh chưa khóa; chỉ dùng khi cần làm mới có chủ đích.
- `node be/scripts/import-province-landmarks.mjs` chỉ in gợi ý; `--apply` ghi dữ liệu. Kết quả tìm kiếm phải được rà lại bằng nguồn trực tiếp trước khi áp dụng. `node be/scripts/curate-province-landmarks.mjs` xem trước các bản ghi đã đối chiếu thủ công, `--apply` mới ghi file; cần kết nối Wikimedia Commons.
- `node be/scripts/discover-wikidata-places.mjs --province=<slug> --name=<từ-khóa>` tìm ứng viên có tọa độ và ảnh từ Wikidata theo ranh giới 34 tỉnh hiện hành. Đây là **danh sách ứng viên**, không phải dữ liệu đã kiểm chứng. `--output=<path>` mới ghi snapshot. Đối chiếu thủ công tên, ảnh và vị trí, đặc biệt các tỉnh sáp nhập và địa điểm ở biên giới. `node be/scripts/import-reviewed-wikidata.mjs` xem trước danh sách QID đã chọn; `--apply` mới ghi ba file dữ liệu. Script cần kết nối Wikidata, GitHub và Wikimedia Commons.
- Nếu môi trường không truy cập dịch vụ ngoài, làm phần kiểm tra nội bộ và ghi rõ những mục chưa xác minh; không tự nâng trạng thái xác minh để lấp khoảng trống.
