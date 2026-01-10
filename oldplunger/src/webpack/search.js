/*
  Code from Cordwood, I think these are for on-demand searching that Vencord also have, Cordwood is simple so we use here,
  might want to impelment the ones from Vencord as well:

  - findBulk
  - findModuleId
  - findModuleFactory
  - findLazy
  - findByPropsLazy
  - findByCode
  - findByCodeLazy
  - findStore (?)
  - findStoreLazy (?)
  - findComponentByCode
  - findComponentByCodeLazy
  - findExportedComponentLazy

  And probably many more from https://github.com/Vendicated/Vencord/blob/main/src/webpack/webpack.ts

  Reminder: These only access currently loaded modules into the the cache.
*/

import { getRequire } from '.';

const filterModules =
  (modules, single = false) =>
  (filter) => {
    let foundModules = [];

    for (const mod in modules) {
      if (modules.hasOwnProperty(mod)) {
        const module = modules[mod].exports;

        if (!module) continue;

        if (module.default && module.__esModule && filter(module.default)) {
          if (single) return module.default;
          foundModules.push(module.default);
        }

        if (filter(module)) {
          if (single) return module;
          else foundModules.push(module);
        }
      }
    }
    if (!single) return foundModules;
  };

const getModules = () => getRequire().c;

export const find = (filter) => filterModules(getModules(), true)(filter);
export const findAll = (filter) => filterModules(getModules())(filter);

const propsFilter = (props) => (m) => props.every((p) => m[p] !== undefined);
const dNameFilter = (name, defaultExp) =>
  defaultExp ? (m) => m.displayName === name : (m) => m?.default?.displayName === name;

export const findByProps = (...props) => find(propsFilter(props));
export const findByPropsAll = (...props) => findAll(propsFilter(props));
export const findByDisplayName = (name, defaultExp = true) => find(dNameFilter(name, defaultExp));
export const findByDisplayNameAll = (name, defaultExp = true) =>
  findAll(dNameFilter(name, defaultExp));
