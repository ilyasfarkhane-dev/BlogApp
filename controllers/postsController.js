const fs = require("fs");
const path = require("path");
const asyncHandler = require("express-async-handler");
const {
  Post,
  validateCreatePost,
  validateUpdatePost,
} = require("../models/Post");
const {
  cloudinaryUploadImage,
  cloudinaryRemoveImage,
} = require("../utils/cloudinary");

/**-----------------------------------------------
 * @desc    Create New Post
 * @route   /api/posts
 * @method  POST
 * @access  private (only logged in user)
 ------------------------------------------------*/
module.exports.createPostCtrl = asyncHandler(async (req, res) => {
  // 1. Validation for image
  if (!req.file) {
    return res.status(400).json({ message: "no image provided" });
  }

  // 2. Validation for data
  const { error } = validateCreatePost(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  // 3. Upload photo
  const imagePath = path.join(__dirname, `../images/${req.file.filename}`);
  const result = await cloudinaryUploadImage(imagePath);

  // 4. Create new post and save it to DB
  const post = await Post.create({
    title: req.body.title,
    description: req.body.description,
    user: req.user.id,
    image: {
      url: result.secure_url,
      publicId: result.public_id,
    },
  });

  // 5. Send response to the client
  res.status(201).json(post);

  // 6. Remove image from the server
  fs.unlinkSync(imagePath);
});

/**-----------------------------------------------
 * @desc    Get All Posts
 * @route   /api/posts
 * @method  GET
 * @access  public
 ------------------------------------------------*/
module.exports.getAllPostsCtrl = asyncHandler(async (req, res) => {
  const POSTS_PER_PAGE = 3;
  const { pageNumber } = req.query;
  let posts;

  if (pageNumber) {
    posts = await Post.find()
      .skip((pageNumber - 1) * POSTS_PER_PAGE)
      .limit(POSTS_PER_PAGE)
      .sort({ createdAt: -1 })
      .populate("user", ["-password"]);
  } else {
    posts = await Post.find()
      .sort({ createdAt: -1 })
      .populate("user", ["-password"]);
  }

  res.status(200).json(posts);
});

/**-----------------------------------------------
 * @desc    Get Single Post
 * @route   /api/posts/:id
 * @method  GET
 * @access  public
 ------------------------------------------------*/
module.exports.getSinglePostCtrl = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id).populate("user", [
    "-password",
  ]);

  if (!post) {
    return res.status(404).json({ message: "post not found" });
  }

  res.status(200).json(post);
});

/**-----------------------------------------------
 * @desc    Delete Post
 * @route   /api/posts/:id
 * @method  DELETE
 * @access  private (only owner of the post)
 ------------------------------------------------*/
module.exports.deletePostCtrl = asyncHandler(async (req, res) => {
  const post = await Post.findById(req.params.id);
  if (!post) {
    return res.status(404).json({ message: "post not found" });
  }

  if (req.user.id === post.user.toString()) {
    await Post.findByIdAndDelete(req.params.id);
    await cloudinaryRemoveImage(post.image.publicId);

    res.status(200).json({
      message: "post has been deleted successfully",
      postId: post._id,
    });
  } else {
    res.status(403).json({ message: "access denied, forbidden" });
  }
});

/**-----------------------------------------------
 * @desc    Update Post
 * @route   /api/posts/:id
 * @method  PUT
 * @access  private (only owner of the post)
 ------------------------------------------------*/
module.exports.updatePostCtrl = asyncHandler(async (req, res) => {
  // 1. Validation
  const { error } = validateUpdatePost(req.body);
  if (error) {
    return res.status(400).json({ message: error.details[0].message });
  }

  // 2. Get the post from DB and check if post exist
  const post = await Post.findById(req.params.id);
  if (!post) {
    return res.status(404).json({ message: "post not found" });
  }

  // 3. check if this post belong to logged in user
  if (req.user.id !== post.user.toString()) {
    return res
      .status(403)
      .json({ message: "access denied, you are not allowed" });
  }

  // 4. Update post
  const updatedPost = await Post.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        title: req.body.title,
        description: req.body.description,
      },
    },
    { new: true }
  ).populate("user", ["-password"]);

  // 5. Send response to the client
  res.status(200).json(updatedPost);
});

/**-----------------------------------------------
 * @desc    Update Post Image
 * @route   /api/posts/update-image/:id
 * @method  PUT
 * @access  private (only owner of the post)
 ------------------------------------------------*/
module.exports.updatePostImageCtrl = asyncHandler(async (req, res) => {
  // 1. Validation
  if (!req.file) {
    return res.status(400).json({ message: "no image provided" });
  }

  // 2. Get the post from DB and check if post exist
  const post = await Post.findById(req.params.id);
  if (!post) {
    return res.status(404).json({ message: "post not found" });
  }

  // 3. Check if this post belong to logged in user
  if (req.user.id !== post.user.toString()) {
    return res
      .status(403)
      .json({ message: "access denied, you are not allowed" });
  }

  // 4. Delete the old image
  await cloudinaryRemoveImage(post.image.publicId);

  // 5. Upload new photo
  const imagePath = path.join(__dirname, `../images/${req.file.filename}`);
  const result = await cloudinaryUploadImage(imagePath);

  // 6. Update the image field in the db
  const updatedPost = await Post.findByIdAndUpdate(
    req.params.id,
    {
      $set: {
        image: {
          url: result.secure_url,
          publicId: result.public_id,
        },
      },
    },
    { new: true }
  );

  // 7. Send response to client
  res.status(200).json(updatedPost);

  // 8. Remvoe image from the server
  fs.unlinkSync(imagePath);
});
