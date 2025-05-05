import { workspaces } from "@angular-devkit/core";
import { Rule, SchematicContext, SchematicsException, Tree } from "@angular-devkit/schematics";
import { Schema } from "./schema";

function createHost(tree: Tree): workspaces.WorkspaceHost {
  return {
    async readFile(path: string): Promise<string> {
      const data = tree.read(path);
      if (!data) throw new SchematicsException('File not found.');
      return data.toString();
    },
    async writeFile(path: string, data: string): Promise<void> {
      tree.overwrite(path, data);
    },
    async isDirectory(path: string): Promise<boolean> {
      return !tree.exists(path) && tree.getDir(path).subfiles.length > 0;
    },
    async isFile(path: string): Promise<boolean> {
      return tree.exists(path);
    },
  };
}

/**
 * Tạo file nếu nó chưa tồn tại, bỏ qua nếu đã tồn tại
 * @param tree Cây thư mục
 * @param path Đường dẫn của file
 * @param content Nội dung file
 */
function createOrSkip(tree: Tree, path: string, content: string): void {
  // Kiểm tra xem file đã tồn tại chưa
  if (!tree.exists(path)) {
    tree.create(path, content);
  }
}

/**
 * Tạo thư mục nếu chưa tồn tại và tạo file gitkeep nếu cần thiết
 * @param tree Cây thư mục
 * @param path Đường dẫn thư mục
 */
function createDirIfNotExists(tree: Tree, path: string, createGitKeep: boolean = true): void {
  if (!tree.exists(path)) {
    tree.getDir(path); // Đảm bảo thư mục tồn tại

    // Tạo file .gitkeep nếu cần
    if (createGitKeep) {
      createOrSkip(tree, `${path}/.gitkeep`, '');
    }
  }
}

export function enterpriseStructure(options: Schema): Rule {
  return async (tree: Tree, _context: SchematicContext) => {
    let sourceRoot = 'src';
    let appPath = 'src/app';

    try {
      const host = createHost(tree);
      const { workspace } = await workspaces.readWorkspace('/', host);

      const projectName = options.project || (workspace.extensions.defaultProject as string | undefined);

      if (projectName) {
        const project = workspace.projects.get(projectName);

        if (project) {
          sourceRoot = (project.sourceRoot as string) || 'src';
          appPath = `${sourceRoot}/app`;
        }
      }
    } catch (error) {
      _context.logger.info('Không tìm thấy workspace hoặc project, sử dụng cấu trúc thư mục mặc định (src/app)');
    }

    const folders = [
      `${appPath}/core`,
      `${appPath}/core/auth`,
      `${appPath}/core/guards`,
      `${appPath}/core/interceptors`,
      `${appPath}/core/http`,
      `${appPath}/core/utils`,
      `${appPath}/layout`,
      `${appPath}/ui`,
      `${appPath}/feature`,
      `${appPath}/pattern`,
    ];

    // Sử dụng hàm createDirIfNotExists thay vì tạo trực tiếp
    folders.forEach(folder => {
      createDirIfNotExists(tree, folder);
    });

    // Tạo file core.ts trong thư mục core
    createCoreFile(tree, appPath);

    // Cập nhật app.config.ts để sử dụng provideCore
    updateAppConfigFile(tree, appPath);

    updateAppComponent(tree, appPath);
    createPortalLayoutComponent(tree, appPath);
    createPageComponents(tree, appPath);
    createInterceptors(tree, appPath);
    createGuards(tree, appPath);
    createHttpServices(tree, appPath);
    
    return tree;
  };
}

function createCoreFile(tree: Tree, appPath: string): void {
  const coreFilePath = `${appPath}/core/core.ts`;
  const coreFileContent = `import { provideHttpClient, withInterceptorsFromDi, withFetch, HTTP_INTERCEPTORS } from "@angular/common/http";
import { ApplicationConfig, provideAppInitializer, provideEnvironmentInitializer, provideZoneChangeDetection } from "@angular/core";
import { provideAnimations } from "@angular/platform-browser/animations";
import { provideAnimationsAsync } from "@angular/platform-browser/animations/async";
import { provideRouter, Routes, withComponentInputBinding, withInMemoryScrolling } from "@angular/router";
import { HttpErrorHandlerInterceptor } from "./interceptors/http-error-handler.interceptor";
import { AuthorizeInterceptor } from "./interceptors/authorize.interceptor";

export interface CoreOptions {
  routes: Routes;
}

/**
 * Provider function for core modules in Angular application
 * Tập trung các providers cơ bản vào một chỗ duy nhất
 */
export function provideCore({routes}: CoreOptions): ApplicationConfig['providers'] {
   return [
        provideZoneChangeDetection({ eventCoalescing: true }),
        provideRouter(routes, withComponentInputBinding(), withInMemoryScrolling({
            scrollPositionRestoration: 'top',
            anchorScrolling: 'enabled',
        })),
        provideHttpClient(withInterceptorsFromDi(), withFetch()),
        [
            { provide: HTTP_INTERCEPTORS, useClass: AuthorizeInterceptor, multi: true, },
            { provide: HTTP_INTERCEPTORS, useClass: HttpErrorHandlerInterceptor, multi: true, },
        ],
        provideAnimations(),
        provideAnimationsAsync(),

        provideAppInitializer(() => {
            console.log('app initialized');
        }),

        provideEnvironmentInitializer(() => {
            console.log('environment initialized');
        }),
    ];
}
`
  createOrSkip(tree, coreFilePath, coreFileContent);
}

function updateAppConfigFile(tree: Tree, appPath: string): void {
  const appConfigPath = `${appPath}/app.config.ts`;
  const appConfigContent = `import { ApplicationConfig } from '@angular/core';
import { routes } from './app.routes';
import { provideCore } from './core/core';

export const appConfig: ApplicationConfig = {
  providers: [
    provideCore({routes})
  ]
};
`;

  if (tree.exists(appConfigPath)) {
    // Nếu file đã tồn tại, cập nhật nội dung
    tree.overwrite(appConfigPath, appConfigContent);
  } else {
    // Nếu file chưa tồn tại, tạo mới
    tree.create(appConfigPath, appConfigContent);
  }
}

function updateAppComponent(tree: Tree, appPath: string): void {
  const appComponentPath = `${appPath}/app.component.ts`;
  if (tree.exists(appComponentPath)) {
    const newAppComponentContent = `import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent {
  // Nội dung AppComponent mới
}
`;
    tree.overwrite(appComponentPath, newAppComponentContent);
  }

  const appComponentHtmlPath = `${appPath}/app.component.html`;
  if (tree.exists(appComponentHtmlPath)) {
    const newAppComponentHtmlContent = `<router-outlet></router-outlet>`;
    tree.overwrite(appComponentHtmlPath, newAppComponentHtmlContent);
  }

  const appComponentScssPath = `${appPath}/app.component.scss`;
  if (tree.exists(appComponentScssPath)) {
    tree.overwrite(appComponentScssPath, '');
  }
}

function createPortalLayoutComponent(tree: Tree, appPath: string): void {
  const layoutFolderPath = `${appPath}/layout`;
  const portalLayoutPath = `${layoutFolderPath}/portal-layout`;

  createDirIfNotExists(tree, portalLayoutPath);

  const componentContent = `import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-portal-layout',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './portal-layout.component.html',
  styleUrls: ['./portal-layout.component.scss']
})
export class PortalLayoutComponent {
  // Portal layout component
}
`;
  createOrSkip(tree, `${portalLayoutPath}/portal-layout.component.ts`, componentContent);

  const templateContent = `<div class="portal-layout">
  <header class="header">
    <div class="header-logo">
      <h1>Portal</h1>
    </div>
    <nav class="header-nav">
    </nav>
    <div class="header-actions">
    </div>
  </header>

  <div class="main-content">
    <aside class="sidebar">
    </aside>

    <main class="content">
      <router-outlet></router-outlet>
    </main>
  </div>

  <footer class="footer">
    <div class="footer-content">
      <p>&copy; 2025 Enterprise Portal</p>
    </div>
  </footer>
</div>
`;
  createOrSkip(tree, `${portalLayoutPath}/portal-layout.component.html`, templateContent);

  const stylesContent = `.portal-layout {
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.header {
  display: flex;
  align-items: center;
  padding: 0.5rem 1rem;
  background-color: #2c3e50;
  color: white;
  height: 60px;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  
  &-logo {
    flex: 0 0 200px;
  }
  
  &-nav {
    flex: 1;
    display: flex;
    justify-content: center;
  }
  
  &-actions {
    flex: 0 0 200px;
    display: flex;
    justify-content: flex-end;
  }
}

.main-content {
  display: flex;
  flex: 1;
}

.sidebar {
  flex: 0 0 250px;
  background-color: #f5f5f5;
  padding: 1rem;
  box-shadow: inset -1px 0 0 rgba(0, 0, 0, 0.1);
}

.content {
  flex: 1;
  padding: 1.5rem;
  overflow-y: auto;
}

.footer {
  background-color: #f8f9fa;
  padding: 1rem;
  text-align: center;
  border-top: 1px solid #e9ecef;
}
`;
  createOrSkip(tree, `${portalLayoutPath}/portal-layout.component.scss`, stylesContent);

  const routesPath = `${appPath}/app.routes.ts`;
  if (tree.exists(routesPath)) {
    const routesContent = `import { Routes } from '@angular/router';
import { PortalLayoutComponent } from './layout/portal-layout/portal-layout.component';

export const routes: Routes = [
  {
    path: '',
    component: PortalLayoutComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('./feature/dashboard/dashboard.component').then(m => m.DashboardComponent)
      }
    ]
  }
];
`;
    tree.overwrite(routesPath, routesContent);

    const dashboardFolderPath = `${appPath}/feature/dashboard`;
    createDirIfNotExists(tree, dashboardFolderPath);

    const dashboardComponentContent = `import { Component } from '@angular/core';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  template: \`
    <h1>Dashboard</h1>
    <p>Welcome to the Enterprise Portal Dashboard</p>
  \`,
  styles: [\`
    :host {
      display: block;
      padding: 1rem;
    }
  \`]
})
export class DashboardComponent {}
`;
    createOrSkip(tree, `${dashboardFolderPath}/dashboard.component.ts`, dashboardComponentContent);
  }
}

function createPageComponents(tree: Tree, appPath: string): void {
  const pageFolderPath = `${appPath}/layout/page`;

  createDirIfNotExists(tree, pageFolderPath);

  const notFoundPath = `${pageFolderPath}/not-found-page`;
  createDirIfNotExists(tree, notFoundPath);

  const notFoundComponentContent = `import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-not-found-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './not-found-page.component.html',
  styleUrls: ['./not-found-page.component.scss']
})
export class NotFoundPageComponent {
  // 404 Not Found Page Component
}
`;
  createOrSkip(tree, `${notFoundPath}/not-found-page.component.ts`, notFoundComponentContent);

  const notFoundTemplateContent = `<div class="not-found-container">
  <h1>404</h1>
  <h2>Page Not Found</h2>
  <p>The page you are looking for does not exist or has been moved.</p>
  <a routerLink="/portal" class="btn-home">Back to Home</a>
</div>
`;
  createOrSkip(tree, `${notFoundPath}/not-found-page.component.html`, notFoundTemplateContent);

  const notFoundStyleContent = `.not-found-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  text-align: center;
  background-color: #f8f9fa;
  
  h1 {
    font-size: 6rem;
    margin-bottom: 0;
    color: #dc3545;
  }
  
  h2 {
    font-size: 2rem;
    margin-bottom: 1rem;
  }
  
  p {
    margin-bottom: 2rem;
    color: #6c757d;
  }
  
  .btn-home {
    padding: 0.75rem 1.5rem;
    background-color: #007bff;
    color: white;
    text-decoration: none;
    border-radius: 4px;
    font-weight: 500;
    transition: background-color 0.2s;
    
    &:hover {
      background-color: #0069d9;
    }
  }
}
`;
  createOrSkip(tree, `${notFoundPath}/not-found-page.component.scss`, notFoundStyleContent);

  const forbiddenPath = `${pageFolderPath}/forbidden-page`;
  createDirIfNotExists(tree, forbiddenPath);

  const forbiddenComponentContent = `import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-forbidden-page',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './forbidden-page.component.html',
  styleUrls: ['./forbidden-page.component.scss']
})
export class ForbiddenPageComponent {
  // 403 Forbidden Page Component
}
`;
  createOrSkip(tree, `${forbiddenPath}/forbidden-page.component.ts`, forbiddenComponentContent);

  const forbiddenTemplateContent = `<div class="forbidden-container">
  <h1>403</h1>
  <h2>Access Forbidden</h2>
  <p>You don't have permission to access this resource.</p>
  <a routerLink="/portal" class="btn-home">Back to Home</a>
</div>
`;
  createOrSkip(tree, `${forbiddenPath}/forbidden-page.component.html`, forbiddenTemplateContent);

  const forbiddenStyleContent = `.forbidden-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100vh;
  text-align: center;
  background-color: #f8f9fa;
  
  h1 {
    font-size: 6rem;
    margin-bottom: 0;
    color: #fd7e14;
  }
  
  h2 {
    font-size: 2rem;
    margin-bottom: 1rem;
  }
  
  p {
    margin-bottom: 2rem;
    color: #6c757d;
  }
  
  .btn-home {
    padding: 0.75rem 1.5rem;
    background-color: #007bff;
    color: white;
    text-decoration: none;
    border-radius: 4px;
    font-weight: 500;
    transition: background-color 0.2s;
    
    &:hover {
      background-color: #0069d9;
    }
  }
}
`;
  createOrSkip(tree, `${forbiddenPath}/forbidden-page.component.scss`, forbiddenStyleContent);

  const routesPath = `${appPath}/app.routes.ts`;
  if (tree.exists(routesPath)) {
    const routesContent = `import { Routes } from '@angular/router';
import { NotFoundPageComponent } from './layout/page/not-found-page/not-found-page.component';
import { ForbiddenPageComponent } from './layout/page/forbidden-page/forbidden-page.component';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'portal'
  },
  {
    path: 'portal',
    loadChildren: () => import('./feature/portal/portal.routes').then(m => m.PORTAL_ROUTES)
  },
  {
    path: '403',
    component: ForbiddenPageComponent
  },
  {
    path: '404',
    component: NotFoundPageComponent
  },
  {
    path: '**',
    redirectTo: '404'
  }
];
`;
    tree.overwrite(routesPath, routesContent);

    const portalFeaturePath = `${appPath}/feature/portal`;
    createDirIfNotExists(tree, portalFeaturePath);

    const portalRoutesContent = `import { Routes } from '@angular/router';
import { PortalLayoutComponent } from '../../layout/portal-layout/portal-layout.component';

export const PORTAL_ROUTES: Routes = [
  {
    path: '',
    component: PortalLayoutComponent,
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'dashboard'
      },
      {
        path: 'dashboard',
        loadComponent: () => import('../dashboard/dashboard.component').then(m => m.DashboardComponent)
      }
    ]
  }
];
`;
    createOrSkip(tree, `${portalFeaturePath}/portal.routes.ts`, portalRoutesContent);
  }
}

function createInterceptors(tree: Tree, appPath: string): void {
  const interceptorsPath = `${appPath}/core/interceptors`;
  
  // Tạo thư mục interceptors nếu chưa tồn tại
  createDirIfNotExists(tree, interceptorsPath, false);
  
  // Tạo file authorize.interceptor.ts
  const authorizeInterceptorContent = `import { HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

@Injectable()
export class AuthorizeInterceptor implements HttpInterceptor {
  
  constructor() {}
  
  /**
   * Intercept all HTTP requests to add authorization headers
   * @param request The outgoing request
   * @param next The next interceptor in the chain
   * @returns An observable of the HTTP event stream
   */
  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    // Thêm token xác thực vào headers nếu người dùng đã đăng nhập
    
    // Lấy token từ localStorage hoặc từ auth service
    // const token = localStorage.getItem('auth_token');
    
    // Nếu có token, thêm vào header Authorization
    // if (token) {
    //   request = request.clone({
    //     setHeaders: {
    //       Authorization: \`Bearer \${token}\`
    //     }
    //   });
    // }
    
    // Chuyển tiếp request đến interceptor tiếp theo
    return next.handle(request);
  }
}`;
  createOrSkip(tree, `${interceptorsPath}/authorize.interceptor.ts`, authorizeInterceptorContent);
  
  // Tạo file http-error-handler.interceptor.ts
  const httpErrorHandlerInterceptorContent = `import { HttpErrorResponse, HttpEvent, HttpHandler, HttpInterceptor, HttpRequest } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable, throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';

@Injectable()
export class HttpErrorHandlerInterceptor implements HttpInterceptor {
  
  constructor() {}
  
  /**
   * Intercept all HTTP requests to handle errors globally
   * @param request The outgoing request
   * @param next The next interceptor in the chain
   * @returns An observable of the HTTP event stream
   */
  intercept(request: HttpRequest<unknown>, next: HttpHandler): Observable<HttpEvent<unknown>> {
    return next.handle(request).pipe(
      catchError((error: HttpErrorResponse) => {
        // Xử lý các lỗi HTTP
        let errorMessage = 'An unknown error occurred';
        
        if (error.error instanceof ErrorEvent) {
          // Client-side error
          errorMessage = \`Error: \${error.error.message}\`;
        } else {
          // Server-side error
          errorMessage = \`Error Code: \${error.status}\\nMessage: \${error.message}\`;
          
          // Xử lý các mã lỗi cụ thể
          switch (error.status) {
            case 401: // Unauthorized
              // Có thể chuyển hướng đến trang đăng nhập hoặc làm mới token
              // this.authService.logout();
              // this.router.navigate(['/login']);
              console.error('Unauthorized access. Redirecting to login...');
              break;
              
            case 403: // Forbidden
              // this.router.navigate(['/forbidden']);
              console.error('Access forbidden.');
              break;
              
            case 404: // Not Found
              // this.router.navigate(['/not-found']);
              console.error('Resource not found.');
              break;
              
            case 500: // Server Error
              console.error('Server error occurred.');
              break;
              
            default:
              console.error(\`Server returned code: \${error.status}, body was: \${error.error}\`);
          }
        }
        
        // Hiển thị thông báo lỗi cho người dùng (có thể dùng toast, snackbar, notification service...)
        // this.notificationService.showError(errorMessage);
        
        // Ghi log lỗi
        console.error(errorMessage);
        
        // Trả về lỗi để component có thể xử lý thêm nếu cần
        return throwError(() => error);
      })
    );
  }
}`;
  createOrSkip(tree, `${interceptorsPath}/http-error-handler.interceptor.ts`, httpErrorHandlerInterceptorContent);
  
  // Tạo file index.ts để export tất cả các interceptor
  const indexContent = `import { HTTP_INTERCEPTORS } from '@angular/common/http';
import { AuthorizeInterceptor } from './authorize.interceptor';
import { HttpErrorHandlerInterceptor } from './http-error-handler.interceptor';

/** Provider đăng ký các HTTP interceptors */
export const httpInterceptorProviders = [
  { provide: HTTP_INTERCEPTORS, useClass: AuthorizeInterceptor, multi: true },
  { provide: HTTP_INTERCEPTORS, useClass: HttpErrorHandlerInterceptor, multi: true }
];`;
  createOrSkip(tree, `${interceptorsPath}/index.ts`, indexContent);
}

function createGuards(tree: Tree, appPath: string): void {
  const guardsPath = `${appPath}/core/guards`;
  
  // Tạo thư mục guards nếu chưa tồn tại
  createDirIfNotExists(tree, guardsPath, false);
  
  // Tạo file auth.guard.ts
  const authGuardContent = `import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthGuard implements CanActivate {

  constructor(private router: Router) {}

  /**
   * Kiểm tra nếu người dùng có quyền truy cập vào route
   * @param route Route đang được truy cập
   * @param state Trạng thái của router
   * @returns Boolean hoặc UrlTree để chuyển hướng
   */
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    // Kiểm tra người dùng đã đăng nhập chưa
    // Ví dụ: const isLoggedIn = this.authService.isLoggedIn();
    const isLoggedIn = false; // Giá trị mẫu, cần thay thế bằng logic thực

    if (isLoggedIn) {
      return true;
    }

    // Nếu chưa đăng nhập, chuyển hướng đến trang login
    // Lưu URL hiện tại để sau khi đăng nhập có thể quay lại
    return this.router.createUrlTree(['/login'], { 
      queryParams: { returnUrl: state.url }
    });
  }
}`;
  createOrSkip(tree, `${guardsPath}/auth.guard.ts`, authGuardContent);
  
  // Tạo file role.guard.ts
  const roleGuardContent = `import { Injectable } from '@angular/core';
import { CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot, Router, UrlTree } from '@angular/router';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class RoleGuard implements CanActivate {

  constructor(private router: Router) {}

  /**
   * Kiểm tra nếu người dùng có vai trò phù hợp để truy cập route
   * @param route Route đang được truy cập
   * @param state Trạng thái của router
   * @returns Boolean hoặc UrlTree để chuyển hướng
   */
  canActivate(
    route: ActivatedRouteSnapshot,
    state: RouterStateSnapshot
  ): Observable<boolean | UrlTree> | Promise<boolean | UrlTree> | boolean | UrlTree {
    // Lấy vai trò được yêu cầu từ route data
    const requiredRole = route.data['role'] as string;
    
    if (!requiredRole) {
      return true; // Không yêu cầu vai trò cụ thể
    }
    
    // Kiểm tra người dùng có vai trò phù hợp không
    // Ví dụ: const userRoles = this.authService.getCurrentUser()?.roles || [];
    const userRoles: string[] = []; // Giá trị mẫu, cần thay thế bằng logic thực
    
    // Kiểm tra xem người dùng có vai trò yêu cầu không
    if (userRoles.includes(requiredRole)) {
      return true;
    }
    
    // Nếu không có quyền, chuyển hướng đến trang 403 Forbidden
    return this.router.createUrlTree(['/403']);
  }
}`;
  createOrSkip(tree, `${guardsPath}/role.guard.ts`, roleGuardContent);
  
  // Tạo file index.ts để export tất cả các guards
  const indexContent = `import { AuthGuard } from './auth.guard';
import { RoleGuard } from './role.guard';

export { AuthGuard, RoleGuard };`;
  createOrSkip(tree, `${guardsPath}/index.ts`, indexContent);
}

function createHttpServices(tree: Tree, appPath: string): void {
  const httpPath = `${appPath}/core/http`;
  const apiModelsPath = `${httpPath}/api-models`;
  
  // Tạo thư mục http và api-models nếu chưa tồn tại
  createDirIfNotExists(tree, httpPath, false);
  createDirIfNotExists(tree, apiModelsPath, false);
  
  // Tạo file injection-tokens.ts
  const injectionTokensContent = `import { environment } from "../../environments/environment";
import { InjectionToken } from "@angular/core";

export const BASE_API_URL = new InjectionToken<string>('BASE_API_URL', {
  providedIn: 'root',
  factory: () => environment.apiUrl,
});
`;
  createOrSkip(tree, `${httpPath}/injection-tokens.ts`, injectionTokensContent);
  
  // Tạo file base-api.ts
  const baseApiContent = `import { HttpClient, HttpParams } from '@angular/common/http';
import { inject } from '@angular/core';
import { BASE_API_URL } from './injection-tokens';
import { Observable } from 'rxjs';

export abstract class BaseApi {
    protected httpClient = inject(HttpClient);
    protected defaultApiBaseUrl = inject<string>(BASE_API_URL);
    protected abstract resourcePath: string;

    protected get apiBaseUrl(): string {
        return this.defaultApiBaseUrl;
    }

    protected get fullUrl(): string {
        return \`\${this.apiBaseUrl}/\${this.resourcePath.replace(/^\\/+/, '')}\`;
    }

    protected createUrl(path: string): string {
        return \`\${this.fullUrl}/\${path.replace(/^\\/+/, '')}\`;
    }

    protected createParams(params: { [key: string]: any }): HttpParams {
        let httpParams = new HttpParams(); //hỗ trợ encodehtml tránh lỗi khi truyền params có dấu 

        Object.entries(params).forEach(([key, value]) => {
            if (value === null || value === undefined) return;

            if (Array.isArray(value)) {
                value.forEach(v => httpParams = httpParams.append(key, v));
            } else if (typeof value === 'object') {
                httpParams = httpParams.set(key, JSON.stringify(value));
            } else {
                httpParams = httpParams.set(key, value.toString());
            }
        });

        return httpParams;
    }

    protected get<T>(path: string, params: any = {}, options: any = {}) {
        return this.httpClient.get<T>(this.createUrl(path), { ...options, params: this.createParams(params), observe: options.observe ?? 'body' }) as Observable<T>;
    }

    protected post<T>(path: string, body: any, options: any = {}): Observable<T> {
        return this.httpClient.post<T>(this.createUrl(path), body, {
            ...options,
            observe: 'body' as const,
        }) as Observable<T>;
    }

    protected put<T>(path: string, body: any, options: any = {}) {
        return this.httpClient.put<T>(this.createUrl(path), body, {
            ...options,
            observe: 'body' as const,
        }) as Observable<T>;
    }

    protected patch<T>(path: string, body: any, options: any = {}) {
        return this.httpClient.patch<T>(this.createUrl(path), body, {
            ...options,
            observe: 'body' as const,
        }) as Observable<T>;
    }

    protected delete<T>(path: string, options: any = {}) {
        return this.httpClient.delete<T>(this.createUrl(path), {
            ...options,
            observe: 'body' as const,
        }) as Observable<T>;
    }
}`;
  createOrSkip(tree, `${httpPath}/base-api.ts`, baseApiContent);
  
  // Tạo file base-response.model.ts
  const baseResponseModelContent = `export interface BaseResponse<T = any> {
    success: boolean;
    data: T;
    message?: string;
    code?: string;
}`;
  createOrSkip(tree, `${apiModelsPath}/base-response.model.ts`, baseResponseModelContent);
  
  // Tạo file paging-response.model.ts
  const pagingResponseModelContent = `export interface PagingMeta {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    hasPreviousPage: boolean;
    hasNextPage: boolean;
}

export interface PagingResponse<T = any> {
    items: T[];
    meta: PagingMeta;
}`;
  createOrSkip(tree, `${apiModelsPath}/paging-response.model.ts`, pagingResponseModelContent);
  
  // Tạo file index.ts trong api-models để export các models
  const apiModelsIndexContent = `export * from './base-response.model';
export * from './paging-response.model';`;
  createOrSkip(tree, `${apiModelsPath}/index.ts`, apiModelsIndexContent);
}