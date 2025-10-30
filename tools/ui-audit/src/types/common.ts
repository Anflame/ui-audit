export type Aliases = {
  [key: string]: string;
};

export type Library = {
  [key: string]: Array<string>;
};

export interface Options {
  splitAntIcons: boolean;
  countIcons: boolean;
  stripUrlPrefix: boolean;
}

export interface Config {
  projectName: string;
  routerFiles: Array<string>;
  srcRoots: Array<string>;
  aliases: Aliases;
  libraries: Library;
  options: Options;
}
