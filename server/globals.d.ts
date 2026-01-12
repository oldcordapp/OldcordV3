interface JSONReviverContext {
  source: string;
}

interface JSON {
  parse(
    text: string,
    reviver?: (this: any, key: string, value: any, context: JSONReviverContext) => any,
  ): any;
}
