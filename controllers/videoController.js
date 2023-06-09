const fs = require("fs");
const { Video, User, Comment } = require("../model/models");
const { log } = require("console");
const path = require("path");
const express = require("express");
const { CLIENT_RENEG_WINDOW } = require("tls");
const APIError = require("../error/ApiError");
const jwt = require("jsonwebtoken");

class VideoController {
	static async getAll(req, res) {
		const videos = await Video.findAll({ raw: true });
		const users = req.users;
		const usersObj = users.reduce(
			(acc, user) => {
				acc[user.id] = user.username;
				return acc;
			},

			{}
		);
		const videosWithUserNames = videos.map((video) => {
			return { ...video, userName: usersObj[video.UserId] };
		});
		res.render("home.hbs", {
			videos: videosWithUserNames,
			styles: '<link href="../css/home.css" rel="stylesheet"></link>',
		});
	}

	static async getOne(req, res) {
		const range = req.headers.range;
		const id = +req.params.id;
		const video = await Video.findOne({ where: { id: id } });
		const videoPath = path.join(
			__dirname,
			`..`,
			"videos",
			`${video.fileName}`
		);
		const start = Number(range.replace(/\D/g, ""));
		const videoSize = fs.statSync(videoPath).size;
		const chunkSize = 10 ** 6;
		const end = Math.min(start + chunkSize, videoSize - 1);
		const contentLength = end - start + 1;
		const headers = {
			"Content-Range": `bytes ${start} - ${end}/${videoSize}`,
			"Accept-Ranges": "bytes",
			"Content-Length": contentLength,
			"Content-Type": "video/mp4",
		};
		res.writeHead(206, headers);

		const videoStream = fs.createReadStream(videoPath, { start, end });
		videoStream.pipe(res);
	}

	static async vidPage(req, res) {
		const id = +req.params.id;
		const video = req.video;
		const user = await User.findOne({
			where: { id: video.UserId },
			raw: true,
		});

		const commentsIncludeNames = await Comment.findAll({
			where: { VideoId: video.id },
			include: [
				{
					model: User,
					attributes: ["username", "id"],
				},
			],
		});
		if (commentsIncludeNames.length > 0) {
			//We get username as a key string, instead of object. Down here we get it as object.
			const commentsWithNames = commentsIncludeNames.map((x) =>
				x.get({ plain: true })
			);
			res.render("video.hbs", {
				video: video,
				author: user,
				comments: commentsWithNames,
				styles: '<link href="../css/vidPage.css" rel="stylesheet"></link>',
			});
		} else {
			res.render("video.hbs", {
				video: video,
				author: user,
				comments: [{ text: "There are no comments", userName: "" }],
				styles: '<link href="../css/vidPage.css" rel="stylesheet"></link>',
			});
		}
	}

	static uploadPage(req, res) {
		res.render("upload.hbs", {
			styles: '<link href="../css/uploadPage.css" rel="stylesheet"></link>',
		});
	}

	static async uploadVideo(req, res, next) {
		console.log(req.file);
		if (!req.file) {
			next(APIError.badRequest("Wrong file fromat"));
		}
		const upload = req.file;
		const token = req.headers.authorization.split(" ")[1];
		const user = jwt.decode(token);
		if (!user) {
			next(APIError.unauthorized("Unauthorized"));
		}
		const videoName = req.body.name;
		try {
			const video = await Video.create({
				name: videoName,
				fileName: upload.originalname,
				UserId: user.id,
			});
			res.json({ message: "Success" });
		} catch (e) {
			next(e);
		}
	}
}

module.exports = VideoController;
