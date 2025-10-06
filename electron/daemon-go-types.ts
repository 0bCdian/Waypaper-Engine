export interface Command {
  type: string;
  payload?: unknown;
}

export interface Event {
  type: string;
  payload?: unknown;
}
