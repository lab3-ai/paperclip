---
name: market-analysis
description: >
  Hướng dẫn agent phân tích thị trường crypto bằng price action — so sánh %
  thay đổi giá, volume, trend. Dùng khi checkout task liên quan phân tích
  market hoặc đọc data từ coingecko-scanner, polymarket-scanner.
---

# Market Analysis Skill

Dùng skill này khi bạn được giao task phân tích thị trường crypto hoặc cần đọc data từ các scanner plugins.

## Quy trình phân tích

### Bước 1: Thu thập data

- Đọc task comments/documents chứa scan results (từ coingecko-scanner hoặc polymarket-scanner)
- Nếu có para-memory skill: đọc data tuần trước để so sánh trend

### Bước 2: So sánh % thay đổi

Cho mỗi coin/market đáng chú ý:
- **Giá 24h**: tăng/giảm bao nhiêu %?
- **Volume 24h**: spike hay giảm so với trung bình?
- **So với tuần trước**: trend đi lên hay xuống?

### Bước 3: Xác định tín hiệu

| Signal | Điều kiện | Hành động |
|--------|----------|-----------|
| 🟢 Bullish mạnh | Giá >+10%, volume >+30% | Tạo subtask viết bài |
| 🟢 Bullish nhẹ | Giá +5% đến +10% | Ghi nhận, theo dõi |
| 🟡 Neutral | Biến động <5% | Ghi nhận |
| 🔴 Bearish nhẹ | Giá -5% đến -10% | Ghi nhận, theo dõi |
| 🔴 Bearish mạnh | Giá <-10%, volume >+30% | Tạo subtask viết bài cảnh báo |

### Bước 4: Tổng hợp

- Xếp hạng coins theo mức độ đáng chú ý (signal mạnh nhất trước)
- Highlight top 3 movers
- Xác định trend chung: Bullish / Bearish / Sideways

### Bước 5: Output

Comment lên task theo template bên dưới. Nếu có signal 🟢 hoặc 🔴 mạnh → tạo subtask cho Content Writer. Nếu có para-memory → lưu kết quả để tuần sau so sánh.

## Template Output

Luôn comment theo format này:

```
## Market Analysis - [Ngày tháng]

### Top Movers (24h)
| Coin | Giá | 24h % | Volume | Signal |
|------|-----|-------|--------|--------|
| BTC  | $XX,XXX | +X.X% | $XXB | 🟢/🔴/🟡 |
| ETH  | $X,XXX  | -X.X% | $XXB | 🟢/🔴/🟡 |
| ...  | ...     | ...   | ...  | ...    |

### Tín hiệu đáng chú ý
- **[COIN]**: [Lý do cụ thể] — [Hành động đề xuất]

### So với tuần trước
- Trend chung: [Bullish/Bearish/Sideways]
- Điểm khác biệt chính: [...]

### Đề xuất
- [ ] Viết bài về [topic] (nếu signal mạnh)
```

## Lưu ý quan trọng

- Chỉ dùng data có sẵn trong task comments hoặc plugin state — không tự bịa số liệu
- Khi không chắc chắn, ghi rõ "data không đủ để kết luận"
- Luôn ghi nguồn data (CoinGecko, Polymarket, X scanner)
