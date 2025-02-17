import url from 'url';

import ciceroMark from '@accordproject/markdown-cicero';
import mardownPdf from '@accordproject/markdown-pdf';
import turndownPluginGithubFlavouredMarkdown from 'joplin-turndown-plugin-gfm';
import jsdom from 'jsdom';
import TurndownService from 'turndown';

import { InaccessibleContentError } from '../errors.js';

const { JSDOM } = jsdom;
const turndownService = new TurndownService();

turndownService.use(turndownPluginGithubFlavouredMarkdown.gfm);

export const LINKS_TO_CONVERT_SELECTOR = 'a[href]:not([href^="#"])';

const { PdfTransformer } = mardownPdf;
const { CiceroMarkTransformer } = ciceroMark;

const ciceroMarkTransformer = new CiceroMarkTransformer();

export default async function filter({ content, mimeType, documentDeclaration }) {
  if (mimeType == 'application/pdf') {
    return filterPDF({ content });
  }

  return filterHTML({
    content,
    documentDeclaration,
  });
}

export async function filterHTML({ content, documentDeclaration }) {
  const {
    location,
    contentSelectors = [],
    noiseSelectors = [],
    filters: serviceSpecificFilters = [],
  } = documentDeclaration;

  const jsdomInstance = new JSDOM(content, {
    url: location,
    virtualConsole: new jsdom.VirtualConsole(),
  });
  const { document: webPageDOM } = jsdomInstance.window;

  for (const filterFunction of serviceSpecificFilters) {
    try {
      /* eslint-disable no-await-in-loop */
      // We want this to be made in series
      await filterFunction(webPageDOM, {
        fetch: location,
        select: contentSelectors,
        remove: noiseSelectors,
        filter: serviceSpecificFilters.map(filter => filter.name),
      });
      /* eslint-enable no-await-in-loop */
    } catch (error) {
      throw new InaccessibleContentError(`The filter function "${filterFunction.name}" failed: ${error}`);
    }
  }

  remove(webPageDOM, noiseSelectors); // remove function works in place

  const domFragment = select(webPageDOM, contentSelectors);

  if (!domFragment.children.length) {
    throw new InaccessibleContentError(`The provided selector "${contentSelectors}" has no match in the web page at '${location}'`);
  }

  convertRelativeURLsToAbsolute(domFragment, location);

  domFragment.querySelectorAll('script, style').forEach(node => node.remove());

  // clean code from common changing patterns - initially for Windstream
  domFragment.querySelectorAll('a[href*="/email-protection"]').forEach(node => {
    if (node.href.match(/((.*?)\/email-protection#)[0-9a-fA-F]+/gim)) {
      node.href = `${node.href.split('#')[0]}#removed`;
    }
  });

  return transform(domFragment);
}

export async function filterPDF({ content: pdfBuffer }) {
  try {
    const ciceroMarkdown = await PdfTransformer.toCiceroMark(pdfBuffer);

    return ciceroMarkTransformer.toMarkdown(ciceroMarkdown);
  } catch (error) {
    if (error.parserError) {
      throw new InaccessibleContentError("Can't parse PDF file");
    }

    throw error;
  }
}

function selectRange(document, rangeSelector) {
  const { startBefore, startAfter, endBefore, endAfter } = rangeSelector;

  const selection = document.createRange();
  const startNode = document.querySelector(startBefore || startAfter);
  const endNode = document.querySelector(endBefore || endAfter);

  if (!startNode) {
    throw new InaccessibleContentError(`The "start" selector has no match in document in: ${JSON.stringify(rangeSelector)}`);
  }

  if (!endNode) {
    throw new InaccessibleContentError(`The "end" selector has no match in document in: ${JSON.stringify(rangeSelector)}`);
  }

  selection[startBefore ? 'setStartBefore' : 'setStartAfter'](startNode);
  selection[endBefore ? 'setEndBefore' : 'setEndAfter'](endNode);

  return selection;
}

export function convertRelativeURLsToAbsolute(document, baseURL) {
  Array.from(document.querySelectorAll(LINKS_TO_CONVERT_SELECTOR)).forEach(link => {
    link.href = url.resolve(baseURL, link.href);
  });
}

// Works in place
function remove(webPageDOM, noiseSelectors) {
  [].concat(noiseSelectors).forEach(selector => {
    if (typeof selector === 'object') {
      const rangeSelection = selectRange(webPageDOM, selector);

      rangeSelection.deleteContents();
    } else {
      Array.from(webPageDOM.querySelectorAll(selector)).forEach(node => node.remove());
    }
  });
}

function select(webPageDOM, contentSelectors) {
  const result = webPageDOM.createDocumentFragment();

  [].concat(contentSelectors).forEach(selector => {
    if (typeof selector === 'object') {
      const rangeSelection = selectRange(webPageDOM, selector);

      result.appendChild(rangeSelection.cloneContents());
    } else {
      webPageDOM.querySelectorAll(selector).forEach(element => result.appendChild(element));
    }
  });

  return result;
}

function transform(domFragment) {
  return turndownService.turndown(domFragment);
}
