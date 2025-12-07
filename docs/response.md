  1. get-version

  | Field   | Giá trị mẫu | Mô tả                    |
  |---------|-------------|--------------------------|
  | version | "0.6.0"     | Phiên bản phần mềm pNode |

  2. get-stats

  | Field            | Giá trị mẫu     | Mô tả                            |
  |------------------|-----------------|----------------------------------|
  | cpu_percent      | 0.49            | % CPU đang sử dụng               |
  | ram_used         | 755,888,128     | RAM đã dùng (bytes)              |
  | ram_total        | 6,213,152,768   | Tổng RAM (bytes)                 |
  | uptime           | 133,093         | Thời gian hoạt động (giây)       |
  | packets_received | 6,328           | Số gói tin nhận được             |
  | packets_sent     | 5,060           | Số gói tin đã gửi                |
  | active_streams   | 2               | Số luồng mạng đang hoạt động     |
  | file_size        | 436,000,000,000 | Kích thước file storage (bytes)  |
  | total_bytes      | 94,012          | Tổng bytes đã xử lý              |
  | total_pages      | 0               | Tổng số trang trong storage      |
  | current_index    | 17              | Index hiện tại (tiến độ đồng bộ) |
  | last_updated     | 1764953798      | Timestamp cập nhật cuối          |

  3. get-pods

  | Field               | Giá trị mẫu          | Mô tả                    |
  |---------------------|----------------------|--------------------------|
  | address             | "152.53.155.15:9001" | Địa chỉ IP:Port của peer |
  | pubkey              | "6PbJSbfG4pMneMo..." | Public key của node      |
  | version             | "0.6.0"              | Phiên bản phần mềm       |
  | last_seen_timestamp | 1765036862           | Thời điểm liên lạc cuối  |
  | total_count         | 11                   | Tổng số pods trong mạng  |