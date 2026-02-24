# Custom AI Extraction API Specification

Tài liệu này mô tả format API mà hệ thống InvoiceAI cần để tích hợp model AI tự train.

## Overview

Edge function `extract-invoice` sẽ gọi đến API endpoint của bạn thay vì (hoặc song song với) Gemini.
Bạn cần build một REST API nhận ảnh/PDF và trả về JSON kết quả trích xuất hóa đơn.

---

## API Endpoint

```
POST {YOUR_API_URL}/extract
Content-Type: application/json
```

### Authentication (tùy chọn)

Nếu API của bạn cần xác thực, hãy thêm header:
```
Authorization: Bearer {YOUR_API_KEY}
```

---

## Request Format

```json
{
  "image_base64": "string (required)",
  "mime_type": "string (required)",
  "options": {
    "language": "vi",
    "invoice_type": "string (optional)"
  }
}
```

### Request Fields

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `image_base64` | string | ✅ | Ảnh hoặc PDF đã encode base64 (không có prefix `data:...;base64,`) |
| `mime_type` | string | ✅ | MIME type của file: `image/jpeg`, `image/png`, `image/webp`, `application/pdf` |
| `options.language` | string | ❌ | Ngôn ngữ hóa đơn, mặc định `"vi"` |
| `options.invoice_type` | string | ❌ | Loại hóa đơn nếu biết trước (vd: `"e-invoice"`, `"receipt"`, `"vat"`) |

### Ví dụ Request

```json
{
  "image_base64": "/9j/4AAQSkZJRgABAQ...",
  "mime_type": "image/jpeg",
  "options": {
    "language": "vi"
  }
}
```

---

## Response Format

### Success Response (HTTP 200)

```json
{
  "success": true,
  "data": {
    "vendor_name": "Công ty TNHH ABC",
    "vendor_tax_id": "0312345678",
    "vendor_address": "123 Nguyễn Huệ, Q1, TP.HCM",
    "vendor_phone": "028-12345678",
    "vendor_fax": "",
    "vendor_account_no": "",
    "buyer_name": "Công ty XYZ",
    "buyer_tax_id": "0398765432",
    "buyer_address": "456 Lê Lợi, Q1, TP.HCM",
    "buyer_account_no": "",
    "invoice_number": "0001234",
    "invoice_serial": "AA/23E",
    "invoice_date": "15/02/2026",
    "payment_method": "Chuyển khoản",
    "currency": "VND",
    "exchange_rate": "",
    "tax_authority_code": "",
    "lookup_code": "",
    "lookup_url": "",
    "subtotal": "5000000",
    "tax_rate": "10",
    "tax_amount": "500000",
    "total_amount": "5500000",
    "amount_in_words": "Năm triệu năm trăm nghìn đồng",
    "line_items": [
      {
        "item_code": "SP001",
        "description": "Bút bi Thiên Long",
        "unit": "Hộp",
        "quantity": "100",
        "unit_price": "50000",
        "amount": "5000000"
      }
    ]
  },
  "confidence": 0.92,
  "metadata": {
    "model_version": "1.0.0",
    "processing_time_ms": 1500
  }
}
```

### Response Fields

#### Top level

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `success` | boolean | ✅ | `true` nếu trích xuất thành công |
| `data` | object | ✅ | Dữ liệu hóa đơn đã trích xuất |
| `confidence` | number | ❌ | Điểm tin cậy 0.0 - 1.0 (nếu model có thể tính) |
| `metadata` | object | ❌ | Thông tin bổ sung (version, thời gian xử lý...) |

#### `data` object

| Field | Type | Description |
|-------|------|-------------|
| `vendor_name` | string | Tên nhà cung cấp / người bán |
| `vendor_tax_id` | string | Mã số thuế người bán |
| `vendor_address` | string | Địa chỉ người bán |
| `vendor_phone` | string | Số điện thoại người bán |
| `vendor_fax` | string | Số fax người bán |
| `vendor_account_no` | string | Số tài khoản người bán |
| `buyer_name` | string | Tên người mua |
| `buyer_tax_id` | string | Mã số thuế người mua |
| `buyer_address` | string | Địa chỉ người mua |
| `buyer_account_no` | string | Số tài khoản người mua |
| `invoice_number` | string | Số hóa đơn |
| `invoice_serial` | string | Ký hiệu / serial hóa đơn |
| `invoice_date` | string | Ngày hóa đơn (format: `dd/MM/yyyy`) |
| `payment_method` | string | Hình thức thanh toán |
| `currency` | string | Loại tiền tệ (`VND`, `USD`, `EUR`...) |
| `exchange_rate` | string | Tỷ giá (nếu ngoại tệ) |
| `tax_authority_code` | string | Mã cơ quan thuế |
| `lookup_code` | string | Mã tra cứu |
| `lookup_url` | string | URL tra cứu hóa đơn |
| `subtotal` | string | Tổng tiền trước thuế (số thuần, không dấu phân cách) |
| `tax_rate` | string | Thuế suất (%) |
| `tax_amount` | string | Tiền thuế |
| `total_amount` | string | Tổng tiền sau thuế |
| `amount_in_words` | string | Số tiền bằng chữ |
| `line_items` | array | Danh sách hàng hóa / dịch vụ |

#### `line_items[]` object

| Field | Type | Description |
|-------|------|-------------|
| `item_code` | string | Mã hàng hóa |
| `description` | string | Tên hàng hóa / dịch vụ |
| `unit` | string | Đơn vị tính |
| `quantity` | string | Số lượng |
| `unit_price` | string | Đơn giá |
| `amount` | string | Thành tiền |

### Error Response

```json
{
  "success": false,
  "error": "Mô tả lỗi",
  "error_code": "INVALID_IMAGE"
}
```

| Error Code | HTTP Status | Description |
|------------|-------------|-------------|
| `INVALID_IMAGE` | 400 | Ảnh không hợp lệ hoặc không đọc được |
| `NOT_INVOICE` | 400 | Ảnh không phải hóa đơn |
| `EXTRACTION_FAILED` | 500 | Trích xuất thất bại |
| `MODEL_ERROR` | 500 | Lỗi model AI |
| `TIMEOUT` | 504 | Xử lý quá thời gian cho phép |

---

## Quy tắc số liệu

- Tất cả số tiền phải là **số thuần** (plain number), không có dấu phân cách nghìn
  - ✅ `"5000000"` 
  - ❌ `"5.000.000"` hoặc `"5,000,000"`
- Dùng dấu chấm `.` làm phân cách thập phân nếu cần: `"2.5"` (2,5%)
- Nếu field không tìm thấy, trả về chuỗi rỗng `""`

---

## Field Mapping (nếu output khác format)

Nếu model của bạn trả về JSON với tên field khác, bạn có 2 lựa chọn:

### Lựa chọn 1: Tự mapping trong API
Mapping output của model sang format trên trước khi trả response.

### Lựa chọn 2: Khai báo mapping
Trả response kèm field `field_mapping` để edge function tự mapping:

```json
{
  "success": true,
  "data": {
    "ten_ncc": "Công ty ABC",
    "mst_ncc": "0312345678",
    "so_hd": "0001234"
  },
  "field_mapping": {
    "ten_ncc": "vendor_name",
    "mst_ncc": "vendor_tax_id",
    "so_hd": "invoice_number"
  }
}
```

---

## Python FastAPI Example

```python
from fastapi import FastAPI
from pydantic import BaseModel
import base64

app = FastAPI()

class ExtractRequest(BaseModel):
    image_base64: str
    mime_type: str
    options: dict = {}

class LineItem(BaseModel):
    item_code: str = ""
    description: str = ""
    unit: str = ""
    quantity: str = ""
    unit_price: str = ""
    amount: str = ""

class InvoiceData(BaseModel):
    vendor_name: str = ""
    vendor_tax_id: str = ""
    vendor_address: str = ""
    vendor_phone: str = ""
    vendor_fax: str = ""
    vendor_account_no: str = ""
    buyer_name: str = ""
    buyer_tax_id: str = ""
    buyer_address: str = ""
    buyer_account_no: str = ""
    invoice_number: str = ""
    invoice_serial: str = ""
    invoice_date: str = ""
    payment_method: str = ""
    currency: str = "VND"
    exchange_rate: str = ""
    tax_authority_code: str = ""
    lookup_code: str = ""
    lookup_url: str = ""
    subtotal: str = ""
    tax_rate: str = ""
    tax_amount: str = ""
    total_amount: str = ""
    amount_in_words: str = ""
    line_items: list[LineItem] = []

@app.post("/extract")
async def extract_invoice(req: ExtractRequest):
    try:
        # Decode image
        image_bytes = base64.b64decode(req.image_base64)
        
        # ---- YOUR MODEL INFERENCE HERE ----
        # result = your_model.predict(image_bytes)
        # ---- END ----
        
        # Map result to InvoiceData format
        invoice_data = InvoiceData(
            # vendor_name=result["ten_ncc"],
            # ...
        )
        
        return {
            "success": True,
            "data": invoice_data.dict(),
            "confidence": 0.92,
            "metadata": {
                "model_version": "1.0.0"
            }
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e),
            "error_code": "EXTRACTION_FAILED"
        }
```

---

## Testing

Bạn có thể test API bằng curl:

```bash
# Encode ảnh sang base64
IMAGE_B64=$(base64 -w0 invoice.jpg)

# Gọi API
curl -X POST http://localhost:8000/extract \
  -H "Content-Type: application/json" \
  -d "{
    \"image_base64\": \"$IMAGE_B64\",
    \"mime_type\": \"image/jpeg\"
  }"
```

---

## Tích hợp vào InvoiceAI

Khi API đã sẵn sàng:
1. Deploy API lên server có IP public
2. Cung cấp URL endpoint (vd: `https://your-server.com/extract`)
3. Cung cấp API key (nếu có)
4. Hệ thống sẽ tự động tích hợp và hỗ trợ chuyển đổi giữa Gemini / Custom AI
