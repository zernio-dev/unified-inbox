/**
 * WhatsApp interactive-message builders + validators.
 *
 * Each builder returns the JSON body fragment to merge into the send POST
 * (alongside accountId). Each validator returns the `canSend` boolean the
 * composer gates the send button on. Length caps (20-char button titles,
 * 24-char list rows, 72-char descriptions) come from the Cloud API.
 */

export const MAX_BUTTONS = 3;
export const MAX_LIST_ROWS = 10;

// 1. Reply buttons -----------------------------------------------------------

export function buildButtonsBody({ message, labels }: { message: string; labels: string[] }) {
  return {
    message,
    buttons: labels
      .filter((l) => l.trim())
      .map((t, i) => ({
        type: 'postback',
        title: t.slice(0, 20),
        payload: (t || String(i)).slice(0, 256),
      })),
  };
}

export function validateButtons({ message, labels }: { message: string; labels: string[] }): boolean {
  return message.trim().length > 0 && labels.some((l) => l.trim().length > 0);
}

// 2. List (single section) ---------------------------------------------------

export interface ListRow {
  title: string;
  description?: string;
}

export function buildListBody({
  message,
  buttonLabel,
  sectionTitle,
  rows,
}: {
  message: string;
  buttonLabel: string;
  sectionTitle: string;
  rows: ListRow[];
}) {
  return {
    interactive: {
      type: 'list',
      body: { text: message },
      action: {
        button: buttonLabel.slice(0, 20),
        sections: [
          {
            ...(sectionTitle.trim() ? { title: sectionTitle.slice(0, 24) } : {}),
            rows: rows
              .filter((r) => r.title.trim())
              .map((r, i) => ({
                id: `row_${i}`,
                title: r.title.slice(0, 24),
                ...(r.description?.trim() ? { description: r.description.slice(0, 72) } : {}),
              })),
          },
        ],
      },
    },
  };
}

export function validateList({
  message,
  buttonLabel,
  rows,
}: {
  message: string;
  buttonLabel: string;
  rows: ListRow[];
}): boolean {
  return (
    message.trim().length > 0 &&
    buttonLabel.trim().length > 0 &&
    rows.some((r) => r.title.trim().length > 0)
  );
}

// 3. CTA URL -----------------------------------------------------------------

export function buildCtaUrlBody({
  message,
  displayText,
  url,
}: {
  message: string;
  displayText: string;
  url: string;
}) {
  return {
    interactive: {
      type: 'cta_url',
      body: { text: message },
      action: {
        name: 'cta_url',
        parameters: { display_text: displayText.slice(0, 20), url },
      },
    },
  };
}

export function validateCtaUrl({
  message,
  displayText,
  url,
}: {
  message: string;
  displayText: string;
  url: string;
}): boolean {
  return message.trim().length > 0 && displayText.trim().length > 0 && url.trim().length > 0;
}

// 4. Flow --------------------------------------------------------------------

export type FlowAction = 'navigate' | 'data_exchange';

export function buildFlowBody({
  message,
  flowId,
  cta,
  flowAction,
  screen,
  uuid = () => crypto.randomUUID(),
}: {
  message: string;
  flowId: string;
  cta: string;
  flowAction: FlowAction;
  screen: string;
  uuid?: () => string;
}) {
  return {
    interactive: {
      type: 'flow',
      body: { text: message },
      action: {
        name: 'flow',
        parameters: {
          flow_message_version: '3',
          flow_token: `${flowId}:${uuid()}`,
          flow_id: flowId,
          flow_cta: cta.slice(0, 20),
          flow_action: flowAction,
          ...(flowAction === 'navigate' ? { flow_action_payload: { screen } } : {}),
        },
      },
    },
  };
}

export function validateFlow({
  message,
  flowId,
  cta,
  flowAction,
  screen,
}: {
  message: string;
  flowId: string;
  cta: string;
  flowAction: FlowAction;
  screen: string;
}): boolean {
  return (
    message.trim().length > 0 &&
    flowId.length > 0 &&
    cta.trim().length > 0 &&
    (flowAction !== 'navigate' || screen.trim().length > 0)
  );
}

// 5. Location request --------------------------------------------------------

export function buildLocationRequestBody({ message }: { message: string }) {
  return {
    interactive: {
      type: 'location_request_message',
      body: { text: message },
      action: { name: 'send_location' },
    },
  };
}

export function validateLocationRequest({ message }: { message: string }): boolean {
  return message.trim().length > 0;
}

// 6. Call button -------------------------------------------------------------

export function buildCallButtonBody({
  message,
  displayText,
}: {
  message: string;
  displayText?: string;
}) {
  return {
    interactive: {
      type: 'voice_call',
      body: { text: message },
      action: {
        name: 'voice_call',
        ...(displayText?.trim() ? { parameters: { display_text: displayText.slice(0, 20) } } : {}),
      },
    },
  };
}

export function validateCallButton({ message }: { message: string }): boolean {
  return message.trim().length > 0;
}
