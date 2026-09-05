import { DOMAIN_ERROR, DomainValidationError } from "./domain-error.js";

const HTTP_URL_PREFIX = /^https?:\/\//i;
const ANY_SCHEME_PREFIX = /^[a-z][a-z0-9+.-]*:/i;
const IPV4_ADDRESS = /^(?:\d{1,3}\.){3}\d{1,3}$/;
const DNS_LABEL = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const AUTHORITY_META = /[*@\[\]\\^$(){}|]/;

function invalidHost(message, input) {
  return new DomainValidationError(DOMAIN_ERROR.INVALID_HOST, message, {
    inputType: typeof input,
  });
}

function authorityFrom(raw, hasScheme) {
  const withoutScheme = hasScheme ? raw.replace(HTTP_URL_PREFIX, "") : raw;
  return withoutScheme.split(/[/?#]/, 1)[0];
}

function validateDnsHostname(hostname, input) {
  if (hostname.length > 253) {
    throw invalidHost("Hostname exceeds 253 ASCII characters.", input);
  }

  const labels = hostname.split(".");
  if (labels.length < 2 || labels.some((label) => !DNS_LABEL.test(label))) {
    throw invalidHost("A valid multi-label DNS hostname is required.", input);
  }

  if (IPV4_ADDRESS.test(hostname)) {
    throw invalidHost("IP addresses are outside the MVP host model.", input);
  }
}

export function normalizeHostInput(input) {
  if (typeof input !== "string") {
    throw invalidHost("Host input must be a string.", input);
  }

  const raw = input.trim();
  if (!raw) throw invalidHost("Host input must not be empty.", input);
  if (/\s/.test(raw)) {
    throw invalidHost("Whitespace is not allowed inside host input.", input);
  }
  if (raw.startsWith("//") || /^[/?#]/.test(raw)) {
    throw invalidHost("A hostname or complete HTTP(S) URL is required.", input);
  }

  const hasHttpScheme = HTTP_URL_PREFIX.test(raw);
  if (ANY_SCHEME_PREFIX.test(raw) && !hasHttpScheme) {
    throw invalidHost("Only complete HTTP(S) URLs are accepted.", input);
  }

  const authority = authorityFrom(raw, hasHttpScheme);
  if (!authority || AUTHORITY_META.test(authority) || authority.includes("%")) {
    throw invalidHost("Ambiguous, wildcard, user-info, or regex host input is rejected.", input);
  }
  if (!hasHttpScheme && authority.includes(":")) {
    throw invalidHost("Bare host input cannot contain a port or IPv6 syntax.", input);
  }

  let parsed;
  try {
    parsed = new URL(hasHttpScheme ? raw : `https://${raw}`);
  } catch {
    throw invalidHost("Host input is not a valid URL or hostname.", input);
  }

  if (!/^https?:$/.test(parsed.protocol) || parsed.username || parsed.password) {
    throw invalidHost("Only credential-free HTTP(S) hosts are accepted.", input);
  }

  let hostname = parsed.hostname.toLowerCase();
  if (hostname.endsWith("..")) {
    throw invalidHost("A hostname can have at most one trailing dot.", input);
  }
  if (hostname.endsWith(".")) hostname = hostname.slice(0, -1);
  if (!hostname || hostname.includes(":") || hostname === "localhost") {
    throw invalidHost("Localhost and IP literals are outside the MVP host model.", input);
  }

  validateDnsHostname(hostname, input);
  return hostname;
}

export function normalizeHostInputs(inputs) {
  if (!Array.isArray(inputs)) {
    throw invalidHost("Host inputs must be an array.", inputs);
  }

  const hosts = [];
  const duplicates = [];
  const seen = new Set();

  for (const input of inputs) {
    const hostname = normalizeHostInput(input);
    if (seen.has(hostname)) duplicates.push(hostname);
    else {
      seen.add(hostname);
      hosts.push(hostname);
    }
  }

  return Object.freeze({
    hosts: Object.freeze(hosts),
    duplicates: Object.freeze(duplicates),
  });
}
