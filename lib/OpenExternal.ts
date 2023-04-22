import { Notice } from "obsidian";
// import { shell } from 'electron';

/**
 * This function opens a Uimport { shell } from 'electron';RL in the user's default external application.
 * If it fails to do so, it displays a notice to the user.
 * @param url - The URL to open.
 */
export const openExternal: (url: string) => Promise<void> = async (
  url: string
) => {
  try {
    await window.open(url);
  } catch {
    new Notice("Failed to open in external application.");
  }
};

// type OpenExternal = (url: string) => Promise<void>;

// let electronOpenExternal: OpenExternal | undefined;

// /**
//  * This function returns the `openExternal` function from the `electron` module.
//  * If the module is not available, it returns a function that resolves immediately.
//  * @returns The `openExternal` function from the `electron` module, or a dummy function.
//  */
// function getElectronOpenExternal(): OpenExternal {
//   if (electronOpenExternal) {
//     return electronOpenExternal;
//   }

//   try {
//     electronOpenExternal = window.open;//shell.openExternal;

//   } catch (e) {
//     electronOpenExternal = (url) => Promise.resolve();
//   }

//   return electronOpenExternal!;
// }
