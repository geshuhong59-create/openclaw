import { Translator } from "../types.js";

export class PassthroughTranslator implements Translator {
  readonly name = "passthrough";

  async translate(text: string): Promise<string> {
    return text;
  }
}
