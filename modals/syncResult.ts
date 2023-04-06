
import { App, Modal } from "obsidian";
import SyncResultContent from "./SyncResult.svelte";


export default class SyncResultModal extends Modal {
  resDescs: string[] = [];
  modalContent: SyncResultContent

  constructor(app: App, res_descs: string[]) {
    super(app);
    this.resDescs = res_descs;
  }

  onOpen() {
    this.titleEl.innerText = "Calendar Sync Result";

    this.modalContent = new SyncResultContent({
      target: this.contentEl,
      props: {
        resDescs: this.resDescs,
      },
    });

    // this.open();
  }

  onClose() {
    super.onClose();
    this.modalContent.$destroy();
  }
}
