/** Shared toast-request payload emitted by profile.page's child components,
 * so the parent page can own the single ion-toast element and its state. */
export interface ToastRequest { msg: string; color: string; }
