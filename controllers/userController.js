const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { User } = require("../model/models");
const APIError = require("../error/ApiError");

const generateJwt = (id, email) => {
	return jwt.sign({ id, email }, process.env.SECRET_KEY, {
		expiresIn: "24h",
	});
};

class UserController {
	static async register(req, res, next) {
		try {
			const { username, email, password } = req.body;
			const hashPassword = await bcrypt
				.hash(password, 10)
				.catch((err) => console.log(err));
			const user = await User.create({
				username: username,
				email: email,
				password: hashPassword,
			});
			const token = generateJwt(user.id, user.email, user.username);
			return res.json(token);
		} catch (e) {
			next(e);
		}
	}

	static registerPage(req, res) {
		if (req.token) {
			res.json(req.token);
		} else {
			res.render("create-account.hbs", {
				styles: '<link href="../css/createAcc.css" rel="stylesheet"></link>',
			});
		}
	}
	static async login(req, res, next) {
		const { email, password } = req.body;
		const user = await User.findOne({ where: { email } });
		if (user) {
			const comparePassword = await bcrypt.compare(
				password,
				user.password
			);
			if (comparePassword) {
				const token = generateJwt(user.id, user.email);
				res.json(token);
			} else {
				next(APIError.badRequest("Wrong password"));
			}
		} else {
			next(APIError.badRequest("Wrong email or password"));
		}
	}

	static async updateToken(req, res, next) {
		const oldToken = req.headers.authorization.split(" ")[1];
		if (!oldToken) {
			next(APIError.badRequest("Empty token"));
		}
		try {
			const verifier = jwt.verify(oldToken, process.env.SECRET_KEY);
			const user = verifier;
			const newToken = generateJwt(user.id, user.email);
			global.token = newToken;
			res.json(newToken);
		} catch (e) {
			next(APIError.badRequest("Wrong token"));
		}
	}

	static async loginPage(req, res) {
		res.render("login.hbs", {
			styles: '<link href="../css/login.css" rel="stylesheet"></link>',
		});
	}

	static async userPage(req, res, next) {
		try {
			const id = req.params.id;
			const user = await User.findOne({ where: { id }, raw: true });
			if (!user) {
				next(APIError.badRequest("This used does not exist"));
			}
			const videos = req.videos;
			res.render("user.hbs", {
				user: user,
				videos: videos,
				styles: '<link href="../css/user.css" rel="stylesheet"></link>',
			});
		} catch (e) {
			next(e);
		}
	}
}

module.exports = UserController;
