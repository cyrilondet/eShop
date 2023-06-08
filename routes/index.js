var express = require("express");
var router = express.Router();

const stripe = require("stripe")(
	"sk_test_51JnKTOIkuoZwZY6GpbbCFUs3cCmyQjfhzXt1wAuW34pB1BCYQpAsFPQ2cQLftUVN84UyNjy35vuTtDLtv5mydpE2005M2hJOVG"
);

/* Création des variables */

const dataBike = [
	{ name: "BIKO45", url: "/images/bike-1.jpg", price: 679, mea: false },
	{ name: "BZOOK07", url: "/images/bike-2.jpg", price: 999, mea: false },
	{ name: "TITANS", url: "/images/bike-3.jpg", price: 799, mea: false },
	{ name: "CEWO", url: "/images/bike-4.jpg", price: 1300, mea: false },
	{ name: "AMIG39", url: "/images/bike-5.jpg", price: 479, mea: false },
	{ name: "LIKO99", url: "/images/bike-6.jpg", price: 869, mea: false },
];

// Fonction calcul frais de port et total commande
const calculTotalCmd = (dataCardBike) => {
	var nbProduct = 0;
	var totalCmd = 0;

	for (var i = 0; i < dataCardBike.length; i++) {
		nbProduct += dataCardBike[i].quantity;
		totalCmd += dataCardBike[i].quantity * dataCardBike[i].price;
	}

	var totalFP = nbProduct * 30;

	if (totalCmd > 2000) {
		totalFP = totalFP * 0.5;
	}
	if (totalCmd > 4000) {
		totalFP = 0;
	}

	totalCmd += totalFP;

	return { totalFP, totalCmd };
};

// Fonction qui récupère les 3 produits à mettre en avant
const meaList = (listBike) => {
	listBike.sort((a, b) => parseFloat(a.price) - parseFloat(b.price));
	
	listBike = listBike.slice(0, 3);

	for(var i=0; i<listBike.length; i++){
		listBike[i].mea=true;
	}

	// dataBike.map()

	return listBike;
}


/* GET home page */
router.get("/", function (req, res, next) {
	console.log(dataBike);
	
	if (!req.session.dataCardBike) {
		req.session.dataCardBike = [];
	}

console.log(meaList(dataBike));
console.log(dataBike);

	res.render("index", { dataBike: dataBike, mea:meaList(dataBike) });
});


/* GET shop page */
router.get("/shop", async function (req, res, next) {
	if (req.session.dataCardBike == undefined) {
		req.session.dataCardBike = [];
	}

	const total = calculTotalCmd(req.session.dataCardBike);

	// Frais de port
	const totalFP = total.totalFP;

	// Total commande
	const totalCmd = total.totalCmd;

	res.render("shop", {
		dataCardBike: req.session.dataCardBike,
		totalCmd,
		totalFP,
	});
});

/* GET Ajouter un vélo */
router.get("/add-shop", async function (req, res, next) {
	if (req.session.dataCardBike == undefined) {
		req.session.dataCardBike = [];
	}

	/*
Le code ci-dessous ne fonctionne pas !
POURQUOI: Au début le panier est vide, donc req.session.dataCardBike.length = 0, par conséquence la boucle ne se lance pas !
Autre problème: le fait de push dans la boucle aura pour conséquence autant de push que de tour de boucle !

	for (let i = 0; i < req.session.dataCardBike.length; i++) {
	  console.log('reqQueryNameFromFor',req.query.nameFromFront);
		if (req.session.dataCardBike[i].name == req.query.nameFromFront) {
			req.session.dataCardBike[i].quantity += 1;
		} else {
			req.session.dataCardBike.push({
				name: req.query.nameFromFront,
				url: req.query.urlFromFront,
				price: req.query.priceFromFront,
				quantity: 1,
			});
		}
	}
  */

	var alreadyExist = false;

	// Au début on entre pas dans la boucle => La variable alreadyExist reste à false.
	for (let i = 0; i < req.session.dataCardBike.length; i++) {
		if (req.session.dataCardBike[i].name == req.query.nameFromFront) {
			req.session.dataCardBike[i].quantity =
				Number(req.session.dataCardBike[i].quantity) + 1; //On ajoute le constructeur Number pour transformer la chaine de caractère req.session.dataCardBike[i].quantity (car info transmit par l'url => chaine de caractère) en nombre. Sans ça on aurait une concaténation. On peut aussi utiliser la fonction parseInt().
			alreadyExist = true;
		}
	}

	// Au début la condition à false est respectée => le vélo est ajouté
	if (alreadyExist == false) {
		req.session.dataCardBike.push({
			name: req.query.nameFromFront,
			url: req.query.urlFromFront,
			price: req.query.priceFromFront,
			quantity: 1,
		});
	}

	res.redirect("/shop");
});

router.get("/delete-shop", function (req, res, next) {
	req.session.dataCardBike.splice(req.query.position, 1);

	res.redirect("/shop");
});

router.post("/update-shop", async function (req, res, next) {
	console.log("post", req.body);
	var newQuantity = req.body.quantity;
	var position = req.body.position;

	req.session.dataCardBike[position].quantity = Number(newQuantity);

	res.redirect("/shop");
});

router.post("/create-checkout-session", async (req, res, next) => {
	if (!req.session.dataCardBike) {
		req.session.dataCardBike = [];
	}


	const total = calculTotalCmd(req.session.dataCardBike);

	// Frais de port
	const totalFP = total.totalFP;

	const stripeItems = [];

	for (let i = 0; i < req.session.dataCardBike.length; i++) {
		stripeItems.push({
			price_data: {
				currency: "eur",
				product_data: {
					name: req.session.dataCardBike[i].name,
				},
				unit_amount: req.session.dataCardBike[i].price * 100,
			},
			quantity: req.session.dataCardBike[i].quantity,
		});
	}

	if (totalFP > 0) {
		stripeItems.push({
			price_data: {
				currency: "eur",
				product_data: {
					name: "Frais de port",
				},
				unit_amount: totalFP * 100,
			},
			quantity: 1,
		});
	}

	const session = await stripe.checkout.sessions.create({
		payment_method_types: ["card"],
		line_items: stripeItems,
		mode: "payment",
		success_url: "http://localhost:3000/success",
		cancel_url: "https://localhost:3000/cancel",
	});

	res.redirect(303, session.url);
});

router.get("/success", (req, res) => {
	res.render("confirm");
});

router.get("/cancel", (req, res) => {
	res.redirect("/");
});

module.exports = router;
