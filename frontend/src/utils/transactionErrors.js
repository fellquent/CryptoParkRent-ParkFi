function collectMessages(error, messages = [], seen = new Set()) {
  if (!error || seen.has(error) || messages.length > 20) {
    return messages;
  }

  if (typeof error === "string") {
    messages.push(error);
    return messages;
  }

  if (typeof error !== "object") {
    return messages;
  }

  seen.add(error);

  if (error.reason) {
    messages.push(error.reason);
  }

  if (error.shortMessage) {
    messages.push(error.shortMessage);
  }

  if (error.message) {
    messages.push(error.message);
  }

  if (error.revert?.args?.[0]) {
    messages.push(error.revert.args[0]);
  }

  collectMessages(error.error, messages, seen);
  collectMessages(error.info, messages, seen);
  collectMessages(error.payload, messages, seen);
  collectMessages(error.cause, messages, seen);

  return messages;
}

function findMessage(error) {
  const messages = collectMessages(error)
    .filter(Boolean)
    .map((message) => String(message));

  return messages.find((message) => !message.includes("could not coalesce error")) ||
    messages[0] ||
    "";
}

export function getTransactionErrorMessage(error, fallback = "Transaction failed.") {
  const message = findMessage(error);
  const normalized = message.toLowerCase();

  if (!message) {
    return fallback;
  }

  if (
    normalized.includes("user rejected") ||
    normalized.includes("user denied") ||
    normalized.includes("action_rejected") ||
    normalized.includes("rejected by user")
  ) {
    return "Transaction was rejected in MetaMask.";
  }

  if (normalized.includes("signguard")) {
    return "MetaMask rejected the transaction through SignGuard. Review the wallet alert or switch to a funded local Hardhat account.";
  }

  if (
    normalized.includes("insufficient funds") ||
    normalized.includes("insufficient balance")
  ) {
    return "This account does not have enough ETH on the selected network.";
  }

  if (normalized.includes("wrong network")) {
    return message;
  }

  return message.length > 240 ? fallback : message;
}

export function getTransactionProgressLabel(update) {
  if (update.stage === "wallet") {
    return "Confirm in MetaMask";
  }

  if (update.stage === "submitted") {
    return "Transaction sent";
  }

  if (update.stage === "confirmed") {
    return "Confirmed";
  }

  return "Submitting...";
}
