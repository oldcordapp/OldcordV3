// Once this gets into JS Spec and thus TS, remove the following JSON fix.
// This porposed JSON parser is being available since Node 21 even though it is not in spec yet.

interface JSONReviverContext {
  source: string;
}

type JSONReviver = (this: any, key: string, value: any, context: JSONReviverContext) => any;

interface JSON {
  parse(text: string, reviver?: JSONReviver): any;
}

interface SyntaxError {
  status: number;
}
