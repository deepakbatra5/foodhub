const express=require('express');const router=express.Router();const bcrypt=require('bcrypt');const jwt=require('jsonwebtoken');const {User}=require('../models');const JWT_SECRET=process.env.JWT_SECRET||'dev_secret';
function createAuthResponse(user){const token=jwt.sign({id:user.id},JWT_SECRET,{expiresIn:'7d'});return{token,user:{id:user.id,name:user.name,email:user.email,role:user.role}}}
async function register(req,res){try{const {name,email,password}=req.body;if(!email||!password)return res.status(400).json({error:'Email & password required'});if(await User.findOne({where:{email}}))return res.status(400).json({error:'Email used'});const user=await User.create({name,email,passwordHash:await bcrypt.hash(password,10)});res.json(createAuthResponse(user));}catch(e){res.status(500).json({error:'Signup failed'})}}
async function login(req,res){try{const {email,password}=req.body;const u=await User.findOne({where:{email}});if(!u||!await bcrypt.compare(password,u.passwordHash))return res.status(400).json({error:'Invalid creds'});res.json(createAuthResponse(u));}catch(e){res.status(500).json({error:'Login failed'})}}
router.post('/register',register);
router.post('/login',login);
module.exports={router,register,login,createAuthResponse};
