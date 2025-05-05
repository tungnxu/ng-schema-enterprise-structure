export interface Schema {
  /** Tên của project để áp dụng schematic */
  project?: string;
  /** Tạo các service xác thực cơ bản */
  addAuth?: boolean;
  /** Tạo các guards bảo vệ route */
  addGuards?: boolean;
  /** Tạo các interceptors cho auth và error handling */
  addInterceptors?: boolean;
  /** Sử dụng NgRx cho state management */
  useNgrx?: boolean;
  /** Tự động cài đặt thư viện NgRx nếu chưa được cài đặt */
  installNgrx?: boolean;
}