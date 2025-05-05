# Auth Features Schematic

Schematic này giúp tạo nhanh các thành phần xác thực cơ bản cho dự án Angular:

- **Authentication Service**: Dịch vụ quản lý đăng nhập/đăng xuất và lưu token
- **Guards**: Route guard để bảo vệ các route yêu cầu xác thực
- **Interceptors**: Auth interceptor để tự động thêm token, Error interceptor để xử lý lỗi
- **NgRx Integration**: Cấu trúc NgRx cho quản lý trạng thái xác thực (actions, reducer, effects, selectors)

## Cách sử dụng

```bash
ng g @nx/enterprise-structure:auth-features --project=my-app
```

## Tùy chọn

| Option | Mô tả | Mặc định |
|--------|--------|---------|
| `--project` | Tên của project để áp dụng schematic | undefined |
| `--addAuth` | Tạo các service xác thực cơ bản | true |
| `--addGuards` | Tạo các guards bảo vệ route | true |
| `--addInterceptors` | Tạo các interceptors cho auth và error handling | true |
| `--useNgrx` | Sử dụng NgRx cho state management | false |
| `--installNgrx` | Tự động cài đặt thư viện NgRx nếu chưa được cài đặt | false |

## Ví dụ

### Tạo đầy đủ các thành phần auth với NgRx

```bash
ng g @nx/enterprise-structure:auth-features --useNgrx=true --installNgrx=true
```

### Chỉ tạo các guard và interceptor

```bash
ng g @nx/enterprise-structure:auth-features --addAuth=false --addGuards=true --addInterceptors=true
```