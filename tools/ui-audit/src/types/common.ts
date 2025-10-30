type Aliases = {
  [key: string]: string;
};

type Library = {
  [key: string]: Array<string>;
};

interface Options {
  splitAntIcons: boolean;
  countIcons: boolean;
  stripUrlPrefix: boolean;
}

interface Config {
  projectName: string;
  routerFiles: Array<string>;
  srcRoots: Array<string>;
  aliases: Aliases;
  libraries: Library;
  options: Options;
}
