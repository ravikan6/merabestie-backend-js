const mongoose = require("mongoose");

const cartSchema = new mongoose.Schema({
	cartId: { type: String, required: true, unique: true }, // Ensuring cartId is unique
	userId: { type: String, required: true }, // Assuming we have a userId associated with the cart
	productsInCart: [
		{
			productId: { type: String, required: true },
			productQty: { type: Number, required: true, default: 1 },
		},
	],
});

module.exports = mongoose.model("Cart", cartSchema);
