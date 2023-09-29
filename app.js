import "dotenv/config";
import express from "express";
import {
  InteractionType,
  InteractionResponseType,
  InteractionResponseFlags,
  MessageComponentTypes,
  ButtonStyleTypes,
} from "discord-interactions";
import {
  VerifyDiscordRequest,
  getRandomEmoji,
  DiscordRequest,
} from "./utils.js";
import { getShuffledOptions, getResult } from "./game.js";

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;
// Parse request body and verifies incoming requests using discord-interactions package
app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY) }));

// Store for in-progress games. In production, you'd want to use a DB
const activeGames = {};

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 */
app.post("/interactions", async function (req, res) {
  // Interaction type and data
  const { type, id, data } = req.body;

  // console.log({ reqbd: req.body });

  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "test" command
    if (name === "test") {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          // Fetches a random emoji to send from a helper function
          content: "hello world " + getRandomEmoji(),
        },
      });
    }

    // "challenge" command
    if (name === "challenge" && id) {
      const userId = req.body.member.user.id;
      console.log({ member: req.body.member });
      // User's object choice
      const objectName = req.body.data.options[0].value;
      console.log({ data: req.body.data.options });
      // Create active game using message ID as the game ID
      activeGames[id] = {
        id: userId,
        objectName,
      };

      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          content: `Rock papers scissors challenge from <@${userId}>`,
          components: [
            {
              type: MessageComponentTypes.ACTION_ROW,
              components: [
                {
                  type: MessageComponentTypes.BUTTON,
                  // Append the game ID to use later on
                  custom_id: `accept_button_${req.body.id}`,
                  label: "Accept",
                  style: ButtonStyleTypes.SUCCESS,
                },
              ],
            },
          ],
        },
      });
    }
    if (name === "store") {
      console.log("in...")
      return res.send({
        type: InteractionResponseType.MODAL,
        data: {
          title: 'Test',
          custom_id: 'test-modal',
          components: [
            {
              type: 1,
              components: [
                {
                  type: 4,
                  style: 1,
                  label: 'Short Input',
                  custom_id: 'short-input',
                  placeholder: 'Short Input',
                },
              ],
            },
            {
              type: 1,
              components: [
                {
                  type: 4,
                  style: 1,
                  label: 'Paragraph Input',
                  custom_id: 'paragraph-input',
                  placeholder: 'Paragraph Input',
                  required: false,
                },
              ],
            },
          ],
        },
      });
    }
  }

  if (type === InteractionType.MESSAGE_COMPONENT) {
    // custom_id set in payload when sending message component
    console.log("inter");
    const componentId = data.custom_id;

    if (componentId.startsWith("accept_button_")) {
      // get the associated game ID
      const gameId = componentId.replace("accept_button_", "");
      // Delete message with token in request body
      const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;
      try {
        await res.send({
          type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
          data: {
            // Fetches a random emoji to send from a helper function
            content: "What is your object of choice?",
            // Indicates it'll be an ephemeral message
            flags: InteractionResponseFlags.EPHEMERAL,
            components: [
              {
                type: MessageComponentTypes.ACTION_ROW,
                components: [
                  {
                    type: MessageComponentTypes.STRING_SELECT,
                    // Append game ID
                    custom_id: `select_choice_${gameId}`,
                    options: getShuffledOptions(),
                  },
                ],
              },
            ],
          },
        });
        // Delete previous message
        await DiscordRequest(endpoint, { method: "DELETE" });
      } catch (err) {
        console.error("Error sending message:", err);
      }
    } else if (componentId.startsWith("select_choice_")) {
      // get the associated game ID
      const gameId = componentId.replace("select_choice_", "");

      if (activeGames[gameId]) {
        // Get user ID and object choice for responding user
        const userId = req.body.member.user.id;
        const objectName = data.values[0];
        // Calculate result from helper function
        const resultStr = getResult(activeGames[gameId], {
          id: userId,
          objectName,
        });

        // Remove game from storage
        delete activeGames[gameId];
        // Update message with token in request body
        const endpoint = `webhooks/${process.env.APP_ID}/${req.body.token}/messages/${req.body.message.id}`;

        try {
          // Send results
          await res.send({
            type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
            data: { content: resultStr },
          });
          // Update ephemeral message
          await DiscordRequest(endpoint, {
            method: "PATCH",
            body: {
              content: "Nice choice " + getRandomEmoji(),
              components: [],
            },
          });
        } catch (err) {
          console.error("Error sending message:", err);
        }
      }
    }
  }
});

app.get("/", (req, res) => res.send("rrrrrr"));

app.listen(PORT, () => {
  console.log("Listening on port", PORT);
});
