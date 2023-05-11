import { BehaviorSubject } from 'rxjs';

export enum NetworkStatus {
  UNKOWN = 1,
  HEALTH,
  CONNECTION_ERROR,
};

export enum SyncStatus {
  UNKOWN = 1,
  UPLOAD, // when patch, insert
  DOWNLOAD, // when list
  SUCCESS_WAITING,
  FAILED_WARNING,
}

export const gfSyncStatus$ = new BehaviorSubject<SyncStatus>(SyncStatus.UNKOWN);
export const gfNetStatus$ = new BehaviorSubject<NetworkStatus>(NetworkStatus.UNKOWN);