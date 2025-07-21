// @ts-check

import { argv } from "node:process";
import { styleText } from "node:util";

const eliTypes = [
  {
    // "eli/bund/{agent}/{year}/{naturalIdentifier}"
    name: "Work ELI",
    level: "Norm",
    exp: /^eli\/bund\/(?<agent>[^/]+)\/(?<year>[^/]+)\/(?<naturalIdentifier>[^/]+)$/,
    examples: ["eli/bund/bgbl-1/2021/s4"],
  },
  {
    // "eli/bund/{agent}/{year}/{naturalIdentifier}/{pointInTime}/{version}/{language}"
    name: "Expression ELI",
    level: "Norm",
    exp: /^eli\/bund\/(?<agent>[^/]+)\/(?<year>[^/]+)\/(?<naturalIdentifier>[^/]+)\/(?<pointInTime>[^/]+)\/(?<version>[^/]+)\/(?<language>[^/]+)$/,
    examples: ["eli/bund/bgbl-1/2021/s4/2021-03-01/1/deu"],
  },
  {
    // "eli/bund/{agent}/{year}/{naturalIdentifier}/{pointInTime}/{version}/{language}/{pointInTimeManifestation?}"
    name: "Manifestation ELI",
    level: "Norm",
    exp: /^eli\/bund\/(?<agent>[^/]+)\/(?<year>[^/]+)\/(?<naturalIdentifier>[^/]+)\/(?<pointInTime>[^/]+)\/(?<version>[^/]+)\/(?<language>[^/]+)(\/(?<pointInTimeManifestation>[^/.]+))?$/,
    examples: [
      "eli/bund/bgbl-1/2021/s4/2021-03-01/1/deu/2021-03-03",
      "eli/bund/bgbl-1/2021/s4/2021-03-01/1/deu",
    ],
  },
  {
    // "eli/bund/{agent}/{year}/{naturalIdentifier}/{subtype}"
    name: "Work ELI",
    level: "Dokument",
    exp: /^eli\/bund\/(?<agent>[^/]+)\/(?<year>[^/]+)\/(?<naturalIdentifier>[^/]+)\/(?<subtype>[^/]+)$/,
    examples: ["eli/bund/bgbl-1/2021/s4/regelungstext-verkuendung-1"],
  },
  {
    // "eli/bund/{agent}/{year}/{naturalIdentifier}/{pointInTime}/{version}/{language}/{subtype}"
    name: "Expression ELI",
    level: "Dokument",
    exp: /^eli\/bund\/(?<agent>[^/]+)\/(?<year>[^/]+)\/(?<naturalIdentifier>[^/]+)\/(?<pointInTime>[^/]+)\/(?<version>[^/]+)\/(?<language>[^/]+)\/(?<subtype>[^/.]+)$/,
    examples: [
      "eli/bund/bgbl-1/2021/s4/2021-03-01/1/deu/regelungstext-verkuendung-1",
    ],
  },
  {
    // "eli/bund/{agent}/{year}/{naturalIdentifier}/{pointInTime}/{version}/{language}/{pointInTimeManifestation?}/{subtype}.{format}"
    name: "Manifestation ELI",
    level: "Dokument",
    exp: /^eli\/bund\/(?<agent>[^/]+)\/(?<year>[^/]+)\/(?<naturalIdentifier>[^/]+)\/(?<pointInTime>[^/]+)\/(?<version>[^/]+)\/(?<language>[^/]+)(\/(?<pointInTimeManifestation>[^/.]+))?\/(?<subtype>[^/.]+)\.(?<format>[^/.]+)$/,
    examples: [
      "eli/bund/bgbl-1/2021/s4/2021-03-01/1/deu/2021-03-03/regelungstext-verkuendung-1.xml",
      "eli/bund/bgbl-1/2021/s4/2021-03-01/1/deu/regelungstext-verkuendung-1.xml",
    ],
  },
];

/**
 * @typedef EliDescription
 * @property {string} eli
 * @property {string} name
 * @property {string} level
 * @property {Record<string, string>} members
 */

/**
 * @param {string} maybeEli
 * @returns {EliDescription[]}
 */
function identifyEli(maybeEli) {
  return eliTypes
    .map((eli) => {
      const match = maybeEli.match(eli.exp);
      if (!match) return null;

      return {
        eli: maybeEli,
        name: eli.name,
        level: eli.level,
        members: match.groups ?? {},
      };
    })
    .filter((i) => !!i);
}

/**
 * @param {string} eli
 * @param {EliDescription[]} descr
 */
function formatEliDescriptions(eli, descr) {
  let result = styleText("underline", eli) + "\n";

  if (!descr.length) {
    result += styleText("red", "\nnot recognized as an ELI\n");
  } else {
    descr.forEach((i) => {
      result += styleText("green", `\nis a ${i.level}-level ${i.name} with:\n`);
      result += Object.entries(i.members)
        .map(([k, v]) => `- ${styleText("bold", k)}: ${v}\n`)
        .join("");
    });
  }

  return result;
}

const [, , ...elisToCheck] = argv;

elisToCheck.forEach((eli) => {
  console.log(formatEliDescriptions(eli, identifyEli(eli)));
});
