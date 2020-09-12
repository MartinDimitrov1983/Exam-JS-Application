//https://mydatabase-b1124.firebaseio.com/
//
import { fireBaseRequestFactory } from './firebase-requests.js';
import { requester } from './app-service.js'
import { createFormEntity } from "./form-helpers.js"

const apiKey = 'https://mydatabase-b1124.firebaseio.com/';
requester.init(apiKey, sessionStorage.getItem('token'));



async function applyCommon(ctx) {

    ctx.username = sessionStorage.getItem("username");
    ctx.loggedIn = !!sessionStorage.getItem("token");
    //const firebaseUserMeta = fireBaseRequestFactory('https://mydatabase-b1124.firebaseio.com/', 'userMeta', sessionStorage.getItem('token'));

    ctx.partials = {
        header: await ctx.load("./templates/header.hbs"),
        footer: await ctx.load("./templates/footer.hbs")
    }

    // if (sessionStorage.getItem('userId')) {
    //     ctx.hasNoTeam = await firebaseUserMeta
    //         .getById(sessionStorage.getItem('userId'))
    //         .then(res => {
    //             return !res || (res && res.team == NO_VALUE);
    //         });
    // }
}

async function homeViewHandler(ctx) {
    await applyCommon(ctx)

    let recipes = await requester.recipes.getAll()
    
    ctx.recipes = Object.entries(recipes || {}).map(([recipeId, recipe]) => ({ ...recipe, recipeId }));
    ctx.loggedInWithRecipes = sessionStorage.getItem('token') && ctx.recipes.length > 0;
    ctx.loggedInWithNoRecipees = sessionStorage.getItem('token') && ctx.recipes.length === 0;

    //successNotification('Please work and disappear')
    await ctx.partial("./templates/home.hbs");
}

async function registerVeiwHandler(ctx) {
    await applyCommon(ctx);
    await ctx.partial('./templates/registerPage.hbs');

    /**
     * Handling form events part
     */
    let formRef = document.querySelector('form');
    formRef.addEventListener('submit', async (e) => {
        e.preventDefault();

        let form = createFormEntity(formRef, ['username', 'password', 'repeatPassword']);
        let formValue = form.getValue();

        if (formValue.password !== formValue.repeatPassword) {
            throw new Error('Password and repeat password must match');
        }

        /**
         * Creates new user
         */
        console.log(formValue.username, formValue.password);

        const newUser = await firebase.auth().createUserWithEmailAndPassword(formValue.username, formValue.password);

        let userToken = await firebase.auth().currentUser.getIdToken();
        sessionStorage.setItem('username', newUser.user.email);
        sessionStorage.setItem('userId', firebase.auth().currentUser.uid);

        sessionStorage.setItem('token', userToken);
        /**
         * Updates the requester authentication token
         */
        requester.setAuthToken(userToken);


        ctx.redirect('#/home');
    });
}

async function loginVeiwHandler(ctx) {
    /**
     * Load hbs templates
     */
    await applyCommon(ctx);
    await ctx.partial('./templates/loginPage.hbs');

    /**
     * Handling form events part
     */
    let formRef = document.querySelector('form');
    formRef.addEventListener('submit', async e => {
        e.preventDefault();

        let form = createFormEntity(formRef, ['username', 'password']);
        let formValue = form.getValue();

        /**
         * Authenticates a user with email and password
         */
        const loggedInUser = await firebase.auth().signInWithEmailAndPassword(formValue.username, formValue.password);
        const userToken = await firebase.auth().currentUser.getIdToken();
        sessionStorage.setItem('username', loggedInUser.user.email);
        sessionStorage.setItem('userId', firebase.auth().currentUser.uid);

        /**
         * Updates the requester authentication token
         */
        sessionStorage.setItem('token', userToken);
        requester.setAuthToken(userToken);


        ctx.redirect('#/home');
    });
}

function logoutHandler(ctx) {
    sessionStorage.clear();
    firebase.auth().signOut();
    ctx.redirect('#/home');
}

async function createRecipeHandler(ctx) {
    /**
     * Load hbs templates
     */
    await applyCommon(ctx)

    await ctx.partial('./templates/createRecipe.hbs');

    /**
     * Handling form events part
     */
    let formRef = document.querySelector('form');
    formRef.addEventListener('submit', async e => {
        e.preventDefault();

        let form = createFormEntity(formRef, ['title', 'description', 'imageURL']);
        let formValue = form.getValue();

        formValue.createdById = sessionStorage.getItem('userId');
        formValue.createdByName = sessionStorage.getItem('username');
        formValue.likes = 0;
        formValue.comments = ["aaa"];
        await requester.recipes.createEntity(formValue);

        form.clear();
        ctx.redirect("#/home")
    });
}

async function detailsHandler(ctx) {
    /**
     * Gets one team from the db and map it to the expected by the template value + add it to the template context
     * 
     * -- this.params comes from the navigation url!!
     */
    
    let { comments, createdById, createdByName, description, imageURL, likes, title} = await requester.recipes.getById(ctx.params.id);
    ctx.recipeId = ctx.params.id;
    ctx.hasComments = comments.slice(1).length > 0
    ctx.comments = comments.slice(1);
    ctx.createdByName = createdByName;
    ctx.description = description;
    ctx.imageURL = imageURL;
    ctx.likes = likes;
    ctx.title = title;
    ctx.userIsCreator = sessionStorage.getItem('userId') === createdById;

    /**
     * Load hbs templates
     */
    await applyCommon(ctx);
    await ctx.partial('./templates/details.hbs');
}

export async function likesHandler(ctx) {

    await requester.recipes.patchEntity({
        likes: Number(ctx.params.currentLikes) + 1
    }, ctx.params.id)

    ctx.redirect(`#/details/${ctx.params.id}`)
    return false;

}

async function deleteHandler(ctx) {

    await requester.recipes.deleteEntity(ctx.params.id);

    ctx.redirect('#/home');
}



// function successNotification(message) {


//     let notificationRef = document.querySelector('#notifications')
//     notificationRef.innerHTML = `<div id="successBox" class="alert alert-success" role="alert">${message}</div>`


//     // setTimeout(() => {
//     //     notificationContainer.remove();
//     // }, 4000);

// }

async function profileHandler(ctx) {
    await applyCommon(ctx)

    let recipes = await requester.recipes.getAll()

    let allRecipes = Object.entries(recipes || {}).map(([recipeId, recipe]) => ({ ...recipe, recipeId }));


    ctx.myRecipes = allRecipes.filter(x => x.createdByName === ctx.username).sort((a,b) => b.likes - a.likes);
    ctx.countmyRecipes = ctx.myRecipes.length > 0
    ctx.recipeName = ctx.myRecipes.map(x => { return {name: x.title} })

    await ctx.partial('./templates/profile.hbs');
}


const app = Sammy('#main', function () {

    this.use('Handlebars', 'hbs');

    this.get("#/", homeViewHandler);
    this.get("#/home", homeViewHandler);

    this.get("#/login", loginVeiwHandler);
    this.post("#/login", () => false)

    this.get("#/register", registerVeiwHandler);
    this.post("#/register", () => false);

    this.get("#/logout", logoutHandler);

    this.get("#/create", createRecipeHandler);
    this.post('#/create', () => false);

    this.get('#/details/:id', detailsHandler);

    this.get('#/likes/:currentLikes/:id', likesHandler)

    
    this.get('#/delete/:id', deleteHandler);
    
    this.get("#/profile", profileHandler);

    // this.get('#/edit/:id', editHandler);
    // this.post('#/edit/:id', () => false);
    // this.get("#/catalog", catalogViewHandler);
    // this.get("#/create", createTeamHandler);
    // this.post("#/create", createTeam);
    // this.get('#/catalog/:id', catalogueDetailsHandler);
    // this.get('#/edit/:id', editTeamHandler);
    // this.post('#/edit/:id', editTeam);
    // this.get("#/leave/:id", leaveTeamHandler);
    // this.get("#/join/:id", joinTeamHandler)


})

app.run('#/');