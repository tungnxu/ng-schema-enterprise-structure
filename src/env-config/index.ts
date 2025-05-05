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
    tree.getDir(path);
    if (createGitKeep) {
      createOrSkip(tree, `${path}/.gitkeep`, '');
    }
  }
}

export function envConfig(options: Schema): Rule {
  return async (tree: Tree, _context: SchematicContext) => {
    const apiUrl = 'https://b2b-uat-api.vgreen.net/internal';
    let sourceRoot = 'src';
    let packageJsonPath = '/package.json';
    let projectName: string | undefined;

    try {
      const host = createHost(tree);
      const { workspace } = await workspaces.readWorkspace('/', host);

      projectName = options.project || (workspace.extensions.defaultProject as string | undefined);
      
      if (projectName) {
        const project = workspace.projects.get(projectName);
        
        if (project) {
          sourceRoot = (project.sourceRoot as string) || 'src';
          packageJsonPath = `/${project.root}/package.json`;
          
          if (project.targets && project.targets.get('build')) {
            const buildTarget = project.targets.get('build');
            
            if (buildTarget && buildTarget.configurations) {
              if (buildTarget.configurations.production) {
                buildTarget.configurations.production = {
                  budgets: [
                    {
                      type: "initial",
                      maximumWarning: "1MB",
                      maximumError: "3MB"
                    },
                    {
                      type: "anyComponentStyle",
                      maximumWarning: "4kB",
                      maximumError: "8kB"
                    }
                  ],
                  outputHashing: "all",
                  fileReplacements: [
                    {
                      replace: `${sourceRoot}/environments/environment.ts`,
                      with: `${sourceRoot}/environments/environment.production.ts`
                    }
                  ],
                  optimization: true,
                  sourceMap: false,
                  extractLicenses: true,
                  namedChunks: false
                };
              }
              
              buildTarget.configurations.staging = {
                optimization: false,
                extractLicenses: false,
                sourceMap: true,
                fileReplacements: [
                  {
                    replace: `${sourceRoot}/environments/environment.ts`,
                    with: `${sourceRoot}/environments/environment.staging.ts`
                  }
                ]
              };
              
              if (buildTarget.configurations.development) {
                buildTarget.configurations.development = {
                  optimization: false,
                  extractLicenses: false,
                  sourceMap: true
                };
              }
            }
          }
          
          await workspaces.writeWorkspace(workspace, host);
        }
      }
    } catch (error) {
      _context.logger.info('Không tìm thấy workspace hoặc project, sử dụng cấu trúc thư mục mặc định (src)');
      _context.logger.info('Không thể cập nhật angular.json: ' + (error as Error).message);
    }

    const envFolderPath = `${sourceRoot}/environments`;
    createDirIfNotExists(tree, envFolderPath);

    const envDefaultContent = `export const environment = {
  production: false,
  apiUrl: '${apiUrl}',
};`;
    createOrSkip(tree, `${envFolderPath}/environment.ts`, envDefaultContent);

    const envStagingContent = `export const environment = {
  production: false,
  apiUrl: '${apiUrl}',
};`;
    createOrSkip(tree, `${envFolderPath}/environment.staging.ts`, envStagingContent);

    const envProdContent = `export const environment = {
  production: true,
  apiUrl: '${apiUrl.replace('-uat-', '-')}',
};`;
    createOrSkip(tree, `${envFolderPath}/environment.production.ts`, envProdContent);

    const coreFolderPath = `${sourceRoot}/app/core`;
    createDirIfNotExists(tree, coreFolderPath, false);

    const injectionTokensPath = `${coreFolderPath}/injection-tokens.ts`;
    const injectionTokensContent = `import { environment } from "../../environments/environment";
import { InjectionToken } from "@angular/core";

export const BASE_API_URL = new InjectionToken<string>('BASE_API_URL', {
  providedIn: 'root',
  factory: () => environment.apiUrl,
});`;

    createOrSkip(tree, injectionTokensPath, injectionTokensContent);

    if (tree.exists(packageJsonPath)) {
      const packageJsonBuffer = tree.read(packageJsonPath);
      if (packageJsonBuffer) {
        const packageJsonContent = packageJsonBuffer.toString();
        let packageJson;

        try {
          packageJson = JSON.parse(packageJsonContent);

          if (!packageJson.scripts) {
            packageJson.scripts = {};
          }

          packageJson.scripts["build:prod"] = "ng build --configuration production";
          packageJson.scripts["build:staging"] = "ng build --configuration staging";

          const updatedPackageJson = JSON.stringify(packageJson, null, 2);
          tree.overwrite(packageJsonPath, updatedPackageJson);
        } catch (e) {
          _context.logger.error('Không thể parse file package.json');
        }
      }
    }

    if (tree.exists('/angular.json')) {
      try {
        const angularJsonBuffer = tree.read('/angular.json');
        if (angularJsonBuffer) {
          const angularJson = JSON.parse(angularJsonBuffer.toString());
          
          const targetProject = projectName || Object.keys(angularJson.projects)[0];
          
          if (targetProject && angularJson.projects[targetProject]) {
            const project = angularJson.projects[targetProject];
            
            if (project.architect && project.architect.build) {
              const buildConfig = project.architect.build;
              
              if (!buildConfig.configurations) {
                buildConfig.configurations = {};
              }
              
              buildConfig.configurations.production = {
                budgets: [
                  {
                    type: "initial",
                    maximumWarning: "1MB",
                    maximumError: "3MB"
                  },
                  {
                    type: "anyComponentStyle",
                    maximumWarning: "4kB",
                    maximumError: "8kB"
                  }
                ],
                outputHashing: "all",
                fileReplacements: [
                  {
                    replace: `${sourceRoot}/environments/environment.ts`,
                    with: `${sourceRoot}/environments/environment.production.ts`
                  }
                ],
                optimization: true,
                sourceMap: false,
                extractLicenses: true,
                namedChunks: false
              };
              
              buildConfig.configurations.staging = {
                optimization: false,
                extractLicenses: false,
                sourceMap: true,
                fileReplacements: [
                  {
                    replace: `${sourceRoot}/environments/environment.ts`,
                    with: `${sourceRoot}/environments/environment.staging.ts`
                  }
                ]
              };
              
              buildConfig.configurations.development = {
                optimization: false,
                extractLicenses: false,
                sourceMap: true
              };
            }
            
            if (project.architect && project.architect.serve && 
                project.architect.serve.configurations) {
              
              if (!project.architect.serve.configurations.staging) {
                project.architect.serve.configurations.staging = {
                    buildTarget: `${targetProject}:build:staging`
                };
              }
            }
          }
          
          tree.overwrite('/angular.json', JSON.stringify(angularJson, null, 2));
        }
      } catch (e) {
        _context.logger.error('Không thể cập nhật angular.json thủ công: ' + (e as Error).message);
      }
    }


    return tree;
  };
}
