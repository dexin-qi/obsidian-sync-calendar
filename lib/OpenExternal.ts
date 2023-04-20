import { Notice } from "obsidian";

export const openExternal: (url: string) => Promise<void> = async (
  url: string
) => {
  try {
    await getElectronOpenExternal()(url);
  } catch {
    new Notice("Failed to open in external application.");
  }
};

type OpenExternal = (url: string) => Promise<void>;

let electronOpenExternal: OpenExternal | undefined;

function getElectronOpenExternal(): OpenExternal {
  if (electronOpenExternal) {
    return electronOpenExternal;
  }

  try {
    electronOpenExternal = require("electron").shell.openExternal;
  } catch (e) {
    electronOpenExternal = (url) => Promise.resolve();
  }

  return electronOpenExternal!;
}