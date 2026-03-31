/**
 * gray-matter (via js-yaml) expects Node's Buffer in some paths. Browsers do not
 * define Buffer; set it before any slide/theme code loads.
 */
import { Buffer } from 'buffer';

if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer;
}
