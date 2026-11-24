export const COLLECTORS_CHANGED_EVENT = 'collectors:changed';

export const notifyCollectorsChanged = () => {
  window.dispatchEvent(new Event(COLLECTORS_CHANGED_EVENT));
};
