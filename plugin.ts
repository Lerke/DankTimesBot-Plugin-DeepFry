import { exec, execSync } from "child_process";
import TelegramBot from "node-telegram-bot-api";
import { BotCommand } from "../../src/bot-commands/bot-command";
import { Chat } from "../../src/chat/chat";
import { User } from "../../src/chat/user/user";
import { AbstractPlugin } from "../../src/plugin-host/plugin/plugin";

export class Plugin extends AbstractPlugin {
    private _hasDependencies = false;

    private static readonly DEFAULT_FRY_FACTOR = 10;
    private static readonly MAX_FRY_FACTOR = 100;

    constructor() {
        super("DeepFry", "1.0.0");
        this._hasDependencies = Plugin.checkSystemDependencies();
        if (!this._hasDependencies) {
            console.log("DeepFry: ImageMagick not found! Plugin cannot function");
        }
    }

    /**
     * @override
     */
    public getPluginSpecificCommands(): BotCommand[] {
        const command = new BotCommand(["deepfry", "fry", "🍟", "😂👌"], "Deepfries your image", this.deepFry.bind(this));
        return [command];
    }

    private async deepFry(chat: Chat, user: User, msg: TelegramBot.Message, match: string): Promise<string> {
        if (!this._hasDependencies) {
            await this.sendMessage(chat.id, "🍟 I don't know how to fry", msg.reply_to_message?.message_id ?? -1);
            return "";
        }

        // Check if message has a photo
        const photo = msg.reply_to_message?.photo ?? msg.photo;
        if (photo) {
            // We'll only fry the first image and ignore if more are provided
            // Find the largest resolution image by simply multiplying w x h
            const imageToFry = photo.reduce((p, c) => (c.width * c.height) > (p.width * p.height) ? c:p, photo[0]);
            this.retrieveFile(chat.id, imageToFry.file_id)
                .then(async data => {
                    const fryFactor = Plugin.getDeepFryScaleRatio(msg);

                    await Plugin.resizeImageToSmallerDimensions(data!, imageToFry);

                    for (let i = 0; i < fryFactor; i++) {
                        await Plugin.imageFry(data!);
                    }

                    // Reset image scale back to original dimensions
                    await Plugin.resetImageToOriginalDimensions(data!, imageToFry);

                    // Respond with fried image
                    const fryCaption = `🍟 I fried your picture ${fryFactor} times!`;
                    await this.sendFile(chat.id, data!, msg.message_id, false, fryCaption);
                });
        } else {
            await this.sendMessage(chat.id, "🍟 I don't know how to fry that", msg.reply_to_message?.message_id ?? -1);
        }

        return "";
    }

    private static checkSystemDependencies(): boolean {
        try {
            const output = execSync("which convert");
            console.log(output);
            return /convert/.test(output.toString());
        } catch(e) {
            console.log(e);
            return false;
        }
    }

    private static getDeepFryScaleRatio(msg: TelegramBot.Message) {
        const matches = (msg.text ?? "").match(/(\d+)/);
        if (matches && matches.length > 1) {
            const factor = Math.max(1, +(matches[1] ?? this.DEFAULT_FRY_FACTOR) ?? 1);
            return Math.min(factor, this.MAX_FRY_FACTOR);
        }
        return this.DEFAULT_FRY_FACTOR;
    }

    private static async resizeImageToSmallerDimensions(path: string, photo: TelegramBot.PhotoSize): Promise<any> {
        const command = `convert ${path} -resize 800x600 ${path}`;
        return new Promise((resolve, reject) => {
            exec(command, (err, stdout, stderr) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(stdout);
            });
        });
    }

    private static async resetImageToOriginalDimensions(path: string, photo: TelegramBot.PhotoSize): Promise<any> {
        const command = `convert ${path} -resize ${photo.width}x${photo.height} ${path}`;
        return new Promise((resolve, reject) => {
            exec(command, (err, stdout, stderr) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(stdout);
            });
        });
    }

    private static async imageFry(path: string): Promise<any> {
        // Credit to 44100hertz @ https://gist.github.com/44100hertz/ec0af5c47b4620966b732e72adad33dc

        let command = "";
        switch (Math.floor(Math.random() * 23)) {
        case 0:
            // Resize 75%
            command = `convert ${path} -resize 75% -filter point -quality 15 ${path}`;
            break;
        case 1:
            // Resize 120%
            command = `convert ${path} -resize 120% -filter point -quality 15 ${path}`;
            break;
        case 2:
            // Equalize Colours
            command = `convert ${path} -equalize -quality 15 ${path}`;
            break;
        case 3:
            // Cropped 1%
            command = `convert ${path} -extent 99% -quality 15 -gravity center ${path}`;
            break;
        case 4:
            // Add 1% border
            command = `convert ${path} -border 1% -quality 15 ${path}`;
            break;
        case 5:
            // Decreased gamma 30%
            command = `convert ${path} -gamma 0.7 -quality 15 ${path}`;
            break;
        case 6:
            // Increased gamma 30%
            command = `convert ${path} -gamma 1.3 -quality 15 ${path}`;
            break;
        case 7:
            // Added vignette
            command = `convert ${path} -background black -vignette 0x100 -quality 15 -brightness-contrast +50x+50 ${path}`;
            break;
        case 8:
            // Applied posterize (reduce # of colours)
            command = `convert ${path} -posterize 8 -quality 15 ${path}`;
            break;
        case 9:
            // Unsharpen image
            command = `convert ${path} -unsharp 0x5 -quality 15 ${path}`;
            break;
        case 10:
            // Reduced blue contrast
            command = `convert ${path} +level-colors '#000040,#ffffa0' -quality 15 ${path}`;
            break;
        case 11:
            // Applied dull instragram like filter
            command = `convert ${path} -modulate 120,40,100 -fill '#222b6d' -colorize 20 -gamma 0.5 -contrast -contrast -quality 15 ${path}`;
            break;
        case 12:
            // applied HIGH CONTRAST instagram-like filter
            command = `convert ${path} -channel R -level 33% -channel G -level 33% -quality 15 ${path}`;
            break;
        case 13:
            // Increased saturation by 50%
            command = `convert ${path} -modulate 100,150,100 -quality 15 ${path}`;
            break;
        case 14:
            // Rotated hue left
            command = `convert ${path} -modulate 100,150,90 -quality 15 ${path}`;
            break;
        case 15:
            // Normalized image
            command = `convert ${path} -normalize -quality 20 ${path}`;
            break;
        case 16:
            // Extra low quality
            command = `convert ${path} -quality 10 ${path}`;
            break;
        case 17:
            // increase contrast
            command = `convert ${path} -sigmoidal-contrast 3x50% -quality 15 ${path}`;
            break;
        case 18:
            // noise removal
            command = `convert ${path} -noise 8 ${path}`;
            break;
        case 19:
            // add noise
            command = `convert ${path} +noise Gaussian -attenuate 0.25 ${path}`;
            break;
        case 20:
            // stretch horizontal
            command = `convert ${path} -resize 109%x91% -filter point -quality 15 ${path}`;
            break;
        case 21:
            // stretch vertical
            command = `convert ${path} -resize 90%x110% -filter point -quality 15 ${path}`;
            break;
        case 22:
            // twisty effect
            command = `convert ${path} -swirl 90 -quality 15 ${path}`;
            break;
        }
        return new Promise((resolve, reject) => {
            exec(command, (err, stdout, stderr) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(stdout);
            });
        });
    }
}
