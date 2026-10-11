# Tìm và biên tập dữ liệu địa điểm

Danh bạ trong `be/data/places.json` là dữ liệu minh họa đã được chọn thủ công, **chưa đầy đủ**. Có 140 địa điểm thuộc 34 tỉnh/thành (địa giới sau sáp nhập năm 2025). Tên, tọa độ và ảnh có thể đến từ nhiều nguồn; địa điểm mới giữ `unverified` và `isDemo: true` cho đến khi có quy trình kiểm chứng. Không tự thêm giá, giờ mở cửa hoặc đánh giá.

## Tìm theo tên và tỉnh

```powershell
# Tìm trong dữ liệu hiện có qua API local
Invoke-RestMethod 'http://localhost:4000/api/places/search?q=hang&province=quang-tri'

# Tìm ứng viên địa danh có tọa độ và ảnh từ Wikidata/Wikimedia Commons
node be/scripts/discover-wikidata-places.mjs --province=quang-tri --name=hang
node be/scripts/discover-wikidata-places.mjs --summary
```

Lệnh tìm ứng viên đọc [Wikidata Query Service](https://query.wikidata.org/), lấy QID, tên, tọa độ `P625`, ảnh `P18` và loại `P31`, rồi đối chiếu với [ranh giới 34 tỉnh](https://github.com/thanglequoc/vietnamese-provinces-database) (MIT). Kết quả là **gợi ý biên tập**, không phải xác nhận địa điểm. Ảnh `P18` đôi khi là ảnh minh họa hoặc nhầm đối tượng; tọa độ có thể là tâm vùng rộng, nằm trên biên giới hoặc sai. Bản snapshot ứng viên tại `be/data/wikidata-discovery.json` giúp tái hiện đợt chọn hiện tại (một phần đã được nhập sau khi rà); làm mới bằng `--output=<path>` sau khi xem trước. Không đưa snapshot thẳng vào runtime.

Danh sách QID được chọn ở `be/scripts/import-reviewed-wikidata.mjs` và một số địa danh bổ sung ở `be/scripts/curate-province-landmarks.mjs`. Chạy không tham số để xem trước; `--apply` mới ghi `places.json`, `photos.json`, `place-sources.json`. Import lấy tác giả, giấy phép, URL ảnh và thumbnail qua [Wikimedia Commons API](https://www.mediawiki.org/wiki/API:Imageinfo). Ảnh được ghi công bên dưới ảnh trên giao diện. Với mỗi mục mới, kiểm tra tên và đối tượng trong ảnh, tỉnh hiện hành, trùng địa điểm và giấy phép; giữ link nguồn ở `place-sources.json`. Xem thêm [skill biên tập](../skills/curate-places/SKILL.md).

## API và mạng xã hội

| Nguồn | Cách dùng phù hợp | Giới hạn |
| --- | --- | --- |
| [Google Places Text Search (New)](https://developers.google.com/maps/documentation/places/web-service/text-search) | Tìm địa điểm trực tiếp theo tên/tỉnh trên server với `PLACES_PROVIDER=google` và `GOOGLE_PLACES_API_KEY` trong `be/.env` | Cần bật Places API (New), billing, quota; không chép hàng loạt kết quả vào `places.json`. [Chính sách lưu trữ và hiển thị](https://developers.google.com/maps/documentation/places/web-service/policies) áp dụng cho nội dung Places. Provider hiện có chưa được kiểm tra với key thật và chưa có bản đồ Google JS. |
| [Wikidata](https://www.wikidata.org/wiki/Wikidata:Data_access) + [Wikimedia Commons](https://commons.wikimedia.org/wiki/Commons:Reusing_content_outside_Wikimedia) | Tạo ứng viên địa danh và lấy ảnh có giấy phép rõ ràng để biên tập vào dữ liệu nội bộ | Dữ liệu có thể thiếu hoặc sai; giấy phép áp dụng riêng cho từng ảnh. |
| [OpenStreetMap](https://www.openstreetmap.org/copyright) | Đối chiếu địa danh/tọa độ, bổ sung danh sách theo vùng khi có nguồn dữ liệu thích hợp | [Nominatim công cộng](https://operations.osmfoundation.org/policies/nominatim/) không cho trích xuất POI hàng loạt; truy vấn lớn cần hạ tầng/extract phù hợp. |
| [TikTok Research API](https://developers.tiktok.com/products/research-api/) | Tham khảo xu hướng nếu đủ điều kiện nghiên cứu | Quyền truy cập hạn chế cho nghiên cứu đủ điều kiện; không phải API danh bạ địa điểm thương mại. Không sao chép video/ảnh để làm ảnh địa điểm. |
| [Meta Graph API](https://developers.facebook.com/docs/graph-api/) | Tra cứu Page khi ứng dụng có quyền API phù hợp và được phê duyệt | Quyền, giới hạn và phạm vi tìm kiếm phụ thuộc sản phẩm/duyệt ứng dụng; không giả định có thể cào mọi bài đăng hay ảnh công khai. |

Muốn xem thêm ngay mà không có key, dùng liên kết **Tìm thêm trên Google Maps** trên trang tìm kiếm: liên kết chuyển tên/tỉnh sang [Google Maps URL](https://developers.google.com/maps/documentation/urls/get-started) và mở trang Google Maps. Khi có key, chép `be/.env.example` thành `be/.env`, đặt `GOOGLE_PLACES_API_KEY` và giữ `PLACES_PROVIDER=local`. Nút **Xem kết quả Google Maps tại đây** gọi `GET /api/google/places/search?q=<tên>&province=<slug>` theo yêu cầu, tối đa 20 kết quả/lần, không cache và không ghi vào dữ liệu local. Ảnh đầu tiên (nếu Google trả về) được tải theo yêu cầu qua `GET /api/google/photo?name=...`, key chỉ nằm ở server; giao diện hiện tác giả và liên kết nguồn. [Place Photos (New)](https://developers.google.com/maps/documentation/places/web-service/place-photos) yêu cầu tên ảnh mới lấy từ kết quả tìm hoặc chi tiết, tên này có thể hết hạn và không được cache. Giới hạn 20 lượt tìm và 100 lượt ảnh/phút/IP để kiểm soát chi phí. Đặt `PLACES_PROVIDER=google` chỉ khi muốn thay toàn bộ nguồn tìm kiếm; chế độ này chưa có adapter bản đồ Google JS. Dữ liệu Google không dùng để làm đầy danh bạ local; muốn bổ sung nội bộ, dùng nguồn cho phép tái sử dụng và duyệt từng mục.
