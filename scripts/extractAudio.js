import { exec } from "child_process";

exec(
  "ffmpeg -i input/interview.mp4 output/audio.wav",
  (error, stdout, stderr) => {
    if (error) {
      console.error(error);
      return;
    }

    console.log("Audio extracted!");
  },
);
