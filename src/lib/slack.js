import { WebClient } from "@slack/web-api";

// --- Channel alerts via incoming webhook (Workflow A) --------------------
// Webhooks are the simplest path for "post to #fleet-alerts". No token needed.
export async function sendSlackChannelAlert(text, blocks) {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return { skipped: true, reason: "SLACK_WEBHOOK_URL not set" };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(blocks ? { text, blocks } : { text }),
    });
    if (!res.ok) {
      const body = await res.text();
      return { error: `Slack webhook ${res.status}: ${body}` };
    }
    return { sent: true };
  } catch (err) {
    console.error("[slack] webhook failed:", err.message);
    return { error: err.message };
  }
}

// --- Direct messages via Web API (Workflow B) ----------------------------
// DMs require a bot token (xoxb-...) with chat:write + im:write scopes.
let _client = null;
function client() {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) return null;
  if (!_client) _client = new WebClient(token);
  return _client;
}

// Sends a DM to a Slack user. `slackUserId` is the member ID stored on User.
export async function sendSlackDM(slackUserId, text, blocks) {
  if (!slackUserId) return { skipped: true, reason: "user has no slackId" };
  const c = client();
  if (!c) return { skipped: true, reason: "SLACK_BOT_TOKEN not set" };

  try {
    // Open (or reuse) the DM channel, then post into it.
    const conv = await c.conversations.open({ users: slackUserId });
    const channel = conv.channel?.id;
    if (!channel) return { error: "could not open DM channel" };

    await c.chat.postMessage({
      channel,
      text,
      ...(blocks ? { blocks } : {}),
    });
    return { sent: true };
  } catch (err) {
    console.error("[slack] DM failed:", err.message);
    return { error: err.message };
  }
}

// Convenience: render a labeled section block list from {label, value} pairs.
export function slackFields(title, rows) {
  return [
    { type: "header", text: { type: "plain_text", text: title } },
    {
      type: "section",
      fields: rows
        .filter((r) => r.value)
        .map((r) => ({ type: "mrkdwn", text: `*${r.label}*\n${r.value}` })),
    },
  ];
}
