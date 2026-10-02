declare module "@commandcode/harness" {
  export interface ExecResult {
    stdout: string;
    stderr: string;
    code: number;
  }

  export interface CommandContext {
    args: string | string[];
  }

  export interface CommandResult {
    message: string;
  }

  export interface ModApi {
    exec(opts: { command: string; args?: string[] }): Promise<ExecResult>;

    ui: {
      capabilities: { status: boolean };
      setStatus(status: string | null): void;
    };

    on(event: string, handler: (event: any) => void): void;

    hooks(lifecycle: {
      onSessionStart?: () => void;
      onSessionEnd?: () => void;
    }): void;

    addCommand(command: {
      name: string;
      description: string;
      argumentHint?: string;
      handler: (ctx: CommandContext) => CommandResult | void;
    }): void;
  }
}