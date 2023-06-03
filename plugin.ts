import { exec, execSync } from "child_process";
import TelegramBot from "node-telegram-bot-api";
import { tmpdir } from "os";
import { BotCommand } from "../../src/bot-commands/bot-command";
import { Chat } from "../../src/chat/chat";
import { User } from "../../src/chat/user/user";
import { AbstractPlugin } from "../../src/plugin-host/plugin/plugin";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const fs = require("fs");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const os = require("os");
// eslint-disable-next-line @typescript-eslint/no-var-requires
const path = require("path");

export class Plugin extends AbstractPlugin {
    private _hasDependencies = false;

    private static readonly DEFAULT_FRY_FACTOR = 10;
    private static readonly MAX_FRY_FACTOR = 100;

    constructor() {
        super("DeepFry", "1.0.3");
        this._hasDependencies = Plugin.checkSystemDependencies();
        if (!this._hasDependencies) {
            console.log("DeepFry: ImageMagick or ffmpeg not found! Plugin cannot function");
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
        let photo: PhotoSize | undefined = undefined;
        let audio: TelegramBot.Audio | undefined = undefined;
        let voice: TelegramBot.Voice | undefined = undefined;
        const isPhoto = !!msg.photo;
        const isPhotoReply = !!msg.reply_to_message?.photo;
        const isSticker = !!msg.sticker;
        const isStickerReply = !!msg.reply_to_message?.sticker;
        const isAnimation = !!msg.animation;
        const isAnimationReply = !!msg.reply_to_message?.animation;
        const isAudio = !!msg.audio;
        const isAudioReply = !!msg.reply_to_message?.audio;
        const isVoice = !!msg.voice;
        const isVoiceReply = msg.reply_to_message!.voice;


        if (isPhotoReply) {
            const largestPhoto =
                msg.reply_to_message!.photo!.reduce((p, c) => (c.width * c.height) > (p.width * p.height) ? c:p, msg!.reply_to_message!.photo![0]!);
            photo = {height: largestPhoto.height, width: largestPhoto.width, fileId: largestPhoto.file_id, extension: "png"};
        } else if (isPhoto) {
            const largestPhoto = msg.photo!.reduce((p, c) => (c.width * c.height) > (p.width * p.height) ? c:p, msg!.photo![0]!);
            photo = {height: largestPhoto.height, width: largestPhoto.width, fileId: largestPhoto.file_id, extension: "png"};
        } else if (isStickerReply && !msg.reply_to_message?.sticker?.is_animated) {
            photo = ({
                extension: "png",
                width: msg.reply_to_message!.sticker!.width,
                height: msg!.reply_to_message!.sticker!.height,
                fileId: msg!.reply_to_message!.sticker!.file_id
            });
        } else if (isSticker && !msg.sticker!.is_animated) {
            photo = ({width: msg.sticker!.width, height: msg.sticker!.height, fileId: msg.sticker!.file_id, extension: "png"});
        } else if (isAnimation && /\.(gif|mp4)$/.test(msg.animation!.file_name ?? "")) {
            photo = ({
                extension: /\.(.+)$/.exec(msg.animation!.file_name!)![1],
                width: msg.animation!.width,
                height: msg.animation!.height,
                fileId: msg.animation!.file_id
            });
        } else if (isAnimationReply && /\.(gif|mp4)$/.test(msg.reply_to_message!.animation?.file_name ?? "")) {
            photo = ({
                extension: /\.(.+)$/.exec(msg.reply_to_message!.animation!.file_name!)![1],
                width: msg.reply_to_message!.animation!.width,
                height: msg.reply_to_message!.animation!.height,
                fileId: msg.reply_to_message!.animation!.file_id
            });
        } else if(isAudio) {
            audio = msg.audio!;
        } else if(isAudioReply) {
            audio = msg.reply_to_message!.audio!;
        } else if(isVoice) {
            voice = msg.voice;
        } else if(isVoiceReply) {
            voice = msg.reply_to_message!.voice;
        }

        if (photo) {
            // We'll only fry the first image and ignore if more are provided
            // Find the largest resolution image by simply multiplying w x h
            this.retrieveFile(chat.id, photo.fileId)
                .then(async data => {
                    const tempDir = "";
                    try {
                        const fryFactor = Plugin.getDeepFryScaleRatio(msg);

                        if (photo!.extension === "mp4" || photo!.extension === "gif") {
                            const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "dtb-deepfry"));
                            let individualFrames: string[] = [];
                            let finalAnimation = "";
                            let  framerate = 24;
                            if (photo!.extension === "mp4") {
                                // Split into individual frames using ffmpeg
                                framerate = await Plugin.mp4Framerate(data!);
                                individualFrames = await Plugin.mp4ToSplitImageArray(data!, tempDir);
                            } else if (photo!.extension === "gif") {
                                // Split into individual frames using convert
                                individualFrames = await Plugin.gifToSplitImageArray(data!, tempDir);
                            }

                            // Individually fry the image using the same filter
                            for (let i = 0; i < fryFactor; i++) {
                                await Plugin.imageFryArray(individualFrames);
                            }

                            finalAnimation = await Plugin.imageFramesToMp4(tempDir, framerate);
                            data = finalAnimation;

                        } else {
                            for (let i = 0; i < fryFactor; i++) {
                                try {
                                    await Plugin.imageFry(data!);
                                } catch (e) {
                                    console.log("Something went wrong while frying image: " + e);
                                }
                            }
                        }

                        // Respond with fried image
                        const fryCaption = `🍟 I fried your picture ${fryFactor} times!`;
                        await this.sendFile(chat.id, data!, msg.message_id, false, fryCaption, "video");

                    } catch (e) {
                        console.log("Frying went wrong");
                        console.log(e);
                    } finally {
                        if (tempDir) {
                            fs.rmSync(tempDir, {recursive: true});
                        }
                    }
                });
        }
        else if (audio) {
            this.retrieveFile(chat.id, audio.file_id)
                .then(async data => {
                    const fryFactor = Plugin.getDeepFryScaleRatio(msg);
                    const outputAudio = await Plugin.audioFry(data!, fryFactor);
                    const fryCaption = `🍟 I fried your audio ${fryFactor} times!`;
                    await this.sendFile(chat.id, outputAudio!, msg.message_id, false, fryCaption, "audio");
                });
        } else if(voice) {
            this.retrieveFile(chat.id, voice.file_id)
                .then(async data => {
                    const fryFactor = Plugin.getDeepFryScaleRatio(msg);
                    const outputAudio = await Plugin.audioFry(data!, fryFactor);
                    const fryCaption = `🍟 I fried your audio ${fryFactor} times!`;
                    await this.sendFile(chat.id, outputAudio!, msg.message_id, false, fryCaption, "voice");

                });
        }
        else {
            await this.sendMessage(chat.id, "🍟 I don't know how to fry that", msg.message_id);
        }

        return "";
    }

    private static checkSystemDependencies(): boolean {
        try {
            const outputIm = execSync("which convert");
            const outputFfmpeg = execSync("which ffmpeg");
            const outputSox = execSync("which sox");
            return /convert/.test(outputIm.toString()) && /ffmpeg/.test(outputFfmpeg.toString()) && /sox/.test(outputSox.toString());
        } catch (e) {
            console.log(e.stdout);
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

    private static async gifToSplitImageArray(gifPath: string, tempDir: string): Promise<string[]> {
        const command = `convert '${gifPath}' '${tempDir}/out%06d.png'`;
        return new Promise((resolve, reject) => {
            exec(command, (err, stdout, stderr) => {
                if (err) {
                    reject(err);
                    return;
                }

                const filesInDirectory = fs.readdirSync(tempDir).map((x: string) => `${tempDir}/${x}`);
                resolve(filesInDirectory);
            });
        });
    }

    private static async mp4Framerate(mp4Path: string): Promise<number> {
        const command = `ffprobe -v error -select_streams v:0 -show_entries stream=avg_frame_rate -of default=nw=1:nk=1 "${mp4Path}"`;
        return new Promise((resolve, reject) => {
            exec(command, (err, stdout, stderr) => {
                if (err) {
                    reject(err);
                    return;
                }

                resolve(Math.round(+eval(stdout)));
            });
        });
    }

    private static async mp4ToSplitImageArray(mp4Path: string, tempDir: string): Promise<string[]> {
        const command = `ffmpeg -i '${mp4Path}' '${tempDir}/out%06d.png'`;
        return new Promise((resolve, reject) => {
            exec(command, (err, stdout, stderr) => {
                if (err) {
                    reject(err);
                    return;
                }

                const filesInDirectory = fs.readdirSync(tempDir).map((x: string) => `${tempDir}/${x}`);
                resolve(filesInDirectory);
            });
        });
    }

    private static async imageFryArray(paths: string[]): Promise<any> {
        const frySeed = Math.floor(Math.random() * 23);
        const deepFryPan = await Promise.allSettled(paths.map((p: string) => Plugin.imageFry(p, frySeed)));
    }

    private static async imageFramesToMp4(imagePath: string, framerate: number): Promise<string> {
        const command = `ffmpeg -framerate ${framerate} -i "${imagePath}/out%06d.png" -c:a copy \
         -shortest -c:v libx264 -pix_fmt yuv420p -vf "crop=trunc(iw/2)*2:trunc(ih/2)*2" ${imagePath}/output.mp4`;
        return new Promise((resolve, reject) => {
            exec(command, (err, stdout, stderr) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(`${imagePath}/output.mp4`);
            });
        });
    }

    private static async audioFry(path: string, passes:  number): Promise<string> {
        const filterPath = Array.from({length: passes})
            .map(f => {
                const seed = Math.floor(Math.random() * 19) % 19;
                switch(seed) {
                case 0:
                    // Bass boost that bitch
                    return "bass 35";
                case 1:
                    return "treble 35";
                case 2:
                    return "chorus 0.5 0.9 50 0.4 0.25 2 −t 60 0.32 0.4 2.3 −t 40 0.3 0.3 1.3 −s";
                case 3:
                    return "delay 0 .05 .1 .15 .2 .25";
                case 4:
                    return "downsample 2";
                case 5:
                    return "echo 0.8 0.9 1000 0.3";
                case 6:
                    return "gain 6";
                case 7:
                    return "phaser 0.89 0.85 1 0.24 2 −t";
                case 8:
                    return "speed 1.35";
                case 9:
                    return "speed 0.65";
                case 10:
                    return "stretch 1.35";
                case 11:
                    return "stretch 0.35";
                case 12:
                    return "tempo 1.25";
                case 13:
                    return "tempo 0.75";
                case 14:
                    return "tremolo 40";
                case 15:
                    return "tremolo 80";
                case 16:
                    return "upsample 2";
                case 17:
                    return "vol 2";
                case 18:
                    return "vol -2";
                default:
                    return "";
                }
            });

        const filterPathString = filterPath.join(" : ");
        const output = `${path}_fried.wav`;
        const soxCmd = `sox '${path}' '${output}' ${filterPathString}`;

        return new Promise((resolve, reject) => {
            exec(soxCmd, (err, stdout, stderr) => {
                if (err) {
                    reject(err);
                    return;
                }
                resolve(output);
            });
        });
    }

    private static async imageFry(path: string, seed?: number): Promise<any> {
        // Credit to 44100hertz @ https://gist.github.com/44100hertz/ec0af5c47b4620966b732e72adad33dc
        let command = "";
        seed = (seed ?? Math.floor(Math.random() * 21)) % 21;
        switch (seed) {
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

interface PhotoSize {
    extension: string;
    fileId: string;
    width: number;
    height: number;
}

interface DeepFryPluginPersistentSettings {
    userPreferences: { [userId: string]: UserDeepFryPreferences };
}

interface UserDeepFryPreferences {
    deepfryMode: UserDeepFryDefaultMode;
    allowList: DeepFryProfile[];
    denyList: DeepFryProfile[];
}

enum UserDeepFryDefaultMode {
    /**
     * Apply all Deep Fry filters
     */
    All,

    /**
     * Only apply user allowedlisted filters
     */
    AllowList,

    /**
     * Apply all except denylisted filters
     */
    DenyList
}

class DeepFryProfileExtensions {
    static DeepFryProfileDescription(profile: DeepFryProfile) {
        switch (profile) {
        case "resize-min-75":
            return "Resizes the image to 75% of its original size";
        case "resize-plus-120":
            return "Resizes the image to 125% of its original size";
        case "equalize-color":
            return "Equalizes the colors of the image";
        case "crop-1":
            return "Crops the image by 1% from the center";
        case "border-1":
            return "Adds a 1% sized border to the image";
        case "gamma-min-30":
            return "Decreases the image its gamma by 30%";
        case "gamma-plus-30":
            return "Increases the image its gamma by 30%";
        case "vignette":
            return "Adds a vignette effect";
        case "posterize":
            return "Posterizes the image, reducing the total number of colors";
        case "unsharpen":
            return "Unsharpens the image by 5";
        case "reduce-blue-contrast":
            return "Reduces the blue contrast of the image";
        case "dull-instagram":
            return "Applies a dull instagram-like effect";
        case "intense-instagram":
            return "Applies an intense instagrama-like effect";
        case "saturation-plus-50":
            return "Increases the saturation of the image by 50%";
        case "rotate-hue-left":
            return "Shifts the hue of the image to the left";
        case "normalize":
            return "Normalizes the image";
        case "extra-low-quality":
            return "Applies an extra-low quality profile to the image";
        case "increase-contrast":
            return "Increases the contrast of the image by 50%";
        case "remove-noise":
            return "Denoises the image by 0.25";
        case "add-noise":
            return "Adds noise to the image";
        case "stretch-horizontal":
            return "Scales the image to 109% x 91%, stretching it horizontally";
        case "stretch-vertical":
            return "Scales the image to 90% x 110%, stretching it vertically";
        case "swirl":
            return "Adds a classic swirly to the image";
        default:
            return "I don't know how that command works";
        }
    }
}

type DeepFryProfile = "resize-min-75"
    | "resize-plus-120"
    | "equalize-color"
    | "crop-1"
    | "border-1"
    | "gamma-min-30"
    | "gamma-plus-30"
    | "vignette"
    | "posterize"
    | "unsharpen"
    | "reduce-blue-contrast"
    | "dull-instagram"
    | "intense-instagram"
    | "saturation-plus-50"
    | "rotate-hue-left"
    | "normalize"
    | "extra-low-quality"
    | "increase-contrast"
    | "remove-noise"
    | "add-noise"
    | "stretch-horizontal"
    | "stretch-vertical"
    | "swirl"

