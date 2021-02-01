
var fs = require("fs");

var  PNG = require("pngjs").PNG;

var data = fs.readFileSync('input/rose.png');
var png = PNG.sync.read(data);

console.log(typeof(png));
console.log(png.data[10]);


  class VariableNode{
      constructor(variableID, mu, sigma, priorID, leftID, rightID, upID, downID){
        this.variableID = variableID;
        this.mu = mu;
        this.sigma = sigma;
        this.priorID = priorID;
        this.leftID = leftID;
        this.rightID = rightID;
        this.upID = upID;
        this.downID = downID;
        this.out_eta = new Array(); //same shape as mu
        this.out_lambda_prime = np.zeros(sigma.shape); //same shape as sigma
      }

      getEta() {
          return this.out_eta;
      }

      getLambdaPrime() {
          return this.out_lambda_prime;
      }

      getMu(){
          return this.mu;
      }

      getSigma(){
          return this.sigma;
      }

      beliefUpdate(){

      }

      computeMsg(){
        //   compute msg right, up, left and down
      }
  }