import { SectionBlock, ActionsBlock, Button } from '@slack/types';

/**
 * Create a reusable button block for Slack.
 * 
 * @param {string} buttonText - The text displayed on the button.
 * @param {string} actionId - The unique ID associated with the button action.
 * @param {string} value - A value to be passed with the button action.
 * @param {string} [optionalText] - Optional text to display alongside the button.
 * @returns {Array<SectionBlock | ActionsBlock>} - A block kit section with a button.
 */
export function createButtonBlock(
    buttonText: string,
    actionId: string,
    value: string,
    optionalText?: string
): Array<SectionBlock | ActionsBlock> {
    const button: Button = {
        type: 'button',
        text: {
            type: 'plain_text',
            text: buttonText,
            emoji: true,
        },
        action_id: actionId,
        value: value,
    };

    const sectionBlock: SectionBlock = {
        type: 'section',
        text: optionalText
            ? {
                  type: 'mrkdwn',
                  text: optionalText,
              }
            : undefined,
    };

    const actionsBlock: ActionsBlock = {
        type: 'actions',
        elements: [button],
    };

    return optionalText ? [sectionBlock, actionsBlock] : [actionsBlock];
}
