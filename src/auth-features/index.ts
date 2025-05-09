import {
  Rule,
  SchematicContext,
  Tree,
  apply,
  mergeWith,
  url,
  template,
  chain,
  move,
  SchematicsException
} from '@angular-devkit/schematics';
import { normalize, strings } from '@angular-devkit/core';
import { NodePackageInstallTask } from '@angular-devkit/schematics/tasks';
import { Schema } from './schema';

export function authFeatures(options: Schema): Rule {
  return (tree: Tree, context: SchematicContext) => {
    const rules: Rule[] = [];
    
    // Tạo các mẫu auth cơ bản
    if (options.addAuth) {
      rules.push(createAuthServices(options));
    }
    
    // Tạo guards
    if (options.addGuards) {
      rules.push(createGuards(options));
    }
    
    // Tạo interceptors
    if (options.addInterceptors) {
      rules.push(createInterceptors(options));
    }
    
    // Xử lý NGRX
    if (options.useNgrx) {
      rules.push(setupNgrx(options, context));
    }
    
    return chain(rules)(tree, context);
  };
}

function createAuthServices(options: Schema): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    const authPath = normalize(`/src/app/core/auth`);
    
    // Tạo các files auth service
    const authTemplate = url('./files/auth');
    const authTemplateSource = apply(authTemplate, [
      template({
        ...strings,
        ...options,
      }),
      move(authPath)
    ]);
    
    return mergeWith(authTemplateSource)(tree, _context);
  };
}

function createGuards(options: Schema): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    const guardsPath = normalize(`/src/app/core/guards`);
    
    // Tạo các files guard
    const guardsTemplate = url('./files/guards');
    const guardsTemplateSource = apply(guardsTemplate, [
      template({
        ...strings,
        ...options,
      }),
      move(guardsPath)
    ]);
    
    return mergeWith(guardsTemplateSource)(tree, _context);
  };
}

function createInterceptors(options: Schema): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    const interceptorsPath = normalize(`/src/app/core/interceptors`);
    
    // Tạo các files interceptor
    const interceptorsTemplate = url('./files/interceptors');
    const interceptorsTemplateSource = apply(interceptorsTemplate, [
      template({
        ...strings,
        ...options,
      }),
      move(interceptorsPath)
    ]);
    
    return mergeWith(interceptorsTemplateSource)(tree, _context);
  };
}

function setupNgrx(options: Schema, context: SchematicContext): Rule {
  return (tree: Tree, _context: SchematicContext) => {
    const rules: Rule[] = [];
    
    // Kiểm tra ngrx đã được cài đặt chưa
    const packageJsonPath = '/package.json';
    if (!tree.exists(packageJsonPath)) {
      throw new SchematicsException('Could not find package.json');
    }
    
    const packageJson = JSON.parse(tree.read(packageJsonPath)!.toString());
    const dependencies = packageJson.dependencies || {};
    const devDependencies = packageJson.devDependencies || {};
    
    const hasNgrx = dependencies['@ngrx/store'] || devDependencies['@ngrx/store'];
    
    // Cài đặt ngrx nếu chưa có và người dùng yêu cầu
    if (!hasNgrx && options.installNgrx) {
      context.addTask(new NodePackageInstallTask({
        packageName: '@ngrx/store @ngrx/effects @ngrx/entity @ngrx/store-devtools'
      }));
    }
    
    // Tạo các files ngrx cho auth
    const ngrxPath = normalize(`/src/app/core/auth/store`);
    
    const ngrxTemplate = url('./files/ngrx');
    const ngrxTemplateSource = apply(ngrxTemplate, [
      template({
        ...strings,
        ...options,
      }),
      move(ngrxPath)
    ]);
    
    rules.push(mergeWith(ngrxTemplateSource));
    
    return chain(rules);
  };
}
