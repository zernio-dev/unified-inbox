import { describe, expect, it } from 'vitest';
import {
  MAX_BUTTONS,
  MAX_LIST_ROWS,
  buildButtonsBody,
  buildCallButtonBody,
  buildCtaUrlBody,
  buildFlowBody,
  buildListBody,
  buildLocationRequestBody,
  validateButtons,
  validateCallButton,
  validateCtaUrl,
  validateFlow,
  validateList,
  validateLocationRequest,
} from '../whatsapp/interactive';

describe('constants', () => {
  it('caps', () => {
    expect(MAX_BUTTONS).toBe(3);
    expect(MAX_LIST_ROWS).toBe(10);
  });
});

describe('buttons', () => {
  it('builds the exact payload, skipping blank labels', () => {
    expect(buildButtonsBody({ message: 'Pick one', labels: ['Yes', '  ', 'No'] })).toEqual({
      message: 'Pick one',
      buttons: [
        { type: 'postback', title: 'Yes', payload: 'Yes' },
        { type: 'postback', title: 'No', payload: 'No' },
      ],
    });
  });

  it('truncates titles to 20 chars', () => {
    const long = 'A'.repeat(30);
    const body = buildButtonsBody({ message: 'm', labels: [long] });
    expect(body.buttons[0].title).toBe('A'.repeat(20));
    expect(body.buttons[0].payload).toBe(long); // payload capped at 256, not 20
  });

  it('validator', () => {
    expect(validateButtons({ message: 'm', labels: ['Yes'] })).toBe(true);
    expect(validateButtons({ message: '   ', labels: ['Yes'] })).toBe(false);
    expect(validateButtons({ message: 'm', labels: ['', '  '] })).toBe(false);
  });
});

describe('list', () => {
  it('builds the exact payload with section title and descriptions', () => {
    expect(
      buildListBody({
        message: 'Choose',
        buttonLabel: 'Open menu',
        sectionTitle: 'Options',
        rows: [
          { title: 'First', description: 'desc' },
          { title: '   ' }, // blank title dropped; ids re-index after the filter
          { title: 'Second' }, // no description key emitted
        ],
      })
    ).toEqual({
      interactive: {
        type: 'list',
        body: { text: 'Choose' },
        action: {
          button: 'Open menu',
          sections: [
            {
              title: 'Options',
              rows: [
                { id: 'row_0', title: 'First', description: 'desc' },
                { id: 'row_1', title: 'Second' },
              ],
            },
          ],
        },
      },
    });
  });

  it('omits section title when blank and truncates fields', () => {
    const body = buildListBody({
      message: 'm',
      buttonLabel: 'B'.repeat(30),
      sectionTitle: '   ',
      rows: [{ title: 'T'.repeat(30), description: 'D'.repeat(100) }],
    });
    const section = body.interactive.action.sections[0];
    expect('title' in section).toBe(false);
    expect(body.interactive.action.button).toBe('B'.repeat(20));
    expect(section.rows[0].title).toBe('T'.repeat(24));
    expect(section.rows[0].description).toBe('D'.repeat(72));
  });

  it('validator', () => {
    const rows = [{ title: 'a' }];
    expect(validateList({ message: 'm', buttonLabel: 'b', rows })).toBe(true);
    expect(validateList({ message: ' ', buttonLabel: 'b', rows })).toBe(false);
    expect(validateList({ message: 'm', buttonLabel: ' ', rows })).toBe(false);
    expect(validateList({ message: 'm', buttonLabel: 'b', rows: [{ title: '  ' }] })).toBe(false);
  });
});

describe('cta_url', () => {
  it('builds the exact payload with 20-char display text truncation', () => {
    expect(
      buildCtaUrlBody({
        message: 'Check this',
        displayText: 'X'.repeat(25),
        url: 'https://example.com',
      })
    ).toEqual({
      interactive: {
        type: 'cta_url',
        body: { text: 'Check this' },
        action: {
          name: 'cta_url',
          parameters: { display_text: 'X'.repeat(20), url: 'https://example.com' },
        },
      },
    });
  });

  it('validator requires all three fields', () => {
    expect(validateCtaUrl({ message: 'm', displayText: 'd', url: 'u' })).toBe(true);
    expect(validateCtaUrl({ message: ' ', displayText: 'd', url: 'u' })).toBe(false);
    expect(validateCtaUrl({ message: 'm', displayText: ' ', url: 'u' })).toBe(false);
    expect(validateCtaUrl({ message: 'm', displayText: 'd', url: ' ' })).toBe(false);
  });
});

describe('flow', () => {
  const uuid = () => 'fixed-uuid';

  it('builds navigate payload with screen and injected uuid', () => {
    expect(
      buildFlowBody({
        message: 'Start',
        flowId: 'flow123',
        cta: 'C'.repeat(25),
        flowAction: 'navigate',
        screen: 'WELCOME',
        uuid,
      })
    ).toEqual({
      interactive: {
        type: 'flow',
        body: { text: 'Start' },
        action: {
          name: 'flow',
          parameters: {
            flow_message_version: '3',
            flow_token: 'flow123:fixed-uuid',
            flow_id: 'flow123',
            flow_cta: 'C'.repeat(20),
            flow_action: 'navigate',
            flow_action_payload: { screen: 'WELCOME' },
          },
        },
      },
    });
  });

  it('data_exchange omits flow_action_payload', () => {
    const body = buildFlowBody({
      message: 'Start',
      flowId: 'flow123',
      cta: 'Go',
      flowAction: 'data_exchange',
      screen: '',
      uuid,
    });
    expect('flow_action_payload' in body.interactive.action.parameters).toBe(false);
    expect(body.interactive.action.parameters.flow_action).toBe('data_exchange');
  });

  it('default uuid produces a usable flow_token', () => {
    const body = buildFlowBody({
      message: 'm',
      flowId: 'f1',
      cta: 'Go',
      flowAction: 'data_exchange',
      screen: '',
    });
    expect(body.interactive.action.parameters.flow_token).toMatch(/^f1:[0-9a-f-]{36}$/);
  });

  it('validator: navigate needs a screen, data_exchange does not', () => {
    const base = { message: 'm', flowId: 'f', cta: 'c' };
    expect(validateFlow({ ...base, flowAction: 'navigate', screen: 'S' })).toBe(true);
    expect(validateFlow({ ...base, flowAction: 'navigate', screen: '  ' })).toBe(false);
    expect(validateFlow({ ...base, flowAction: 'data_exchange', screen: '' })).toBe(true);
    expect(validateFlow({ ...base, message: ' ', flowAction: 'data_exchange', screen: '' })).toBe(false);
    expect(validateFlow({ ...base, flowId: '', flowAction: 'data_exchange', screen: '' })).toBe(false);
    expect(validateFlow({ ...base, cta: ' ', flowAction: 'data_exchange', screen: '' })).toBe(false);
  });
});

describe('location request', () => {
  it('builds the exact payload', () => {
    expect(buildLocationRequestBody({ message: 'Where are you?' })).toEqual({
      interactive: {
        type: 'location_request_message',
        body: { text: 'Where are you?' },
        action: { name: 'send_location' },
      },
    });
  });

  it('validator', () => {
    expect(validateLocationRequest({ message: 'm' })).toBe(true);
    expect(validateLocationRequest({ message: '   ' })).toBe(false);
  });
});

describe('call button', () => {
  it('builds with truncated display text', () => {
    expect(buildCallButtonBody({ message: 'Call us', displayText: 'D'.repeat(30) })).toEqual({
      interactive: {
        type: 'voice_call',
        body: { text: 'Call us' },
        action: { name: 'voice_call', parameters: { display_text: 'D'.repeat(20) } },
      },
    });
  });

  it('omits parameters when display text is blank or missing', () => {
    expect(buildCallButtonBody({ message: 'Call us', displayText: '  ' })).toEqual({
      interactive: {
        type: 'voice_call',
        body: { text: 'Call us' },
        action: { name: 'voice_call' },
      },
    });
    expect(buildCallButtonBody({ message: 'Call us' }).interactive.action).toEqual({
      name: 'voice_call',
    });
  });

  it('validator', () => {
    expect(validateCallButton({ message: 'm' })).toBe(true);
    expect(validateCallButton({ message: ' ' })).toBe(false);
  });
});
