/// <reference path="../typings/tsd.d.ts" />
"use strict";

import Basics = require("./basics") // Prop up
import Lookup = Basics.Lookup;

import HigherObjectModule = require("higher-object");
import isInstanceOf = HigherObjectModule.isInstanceOf;
import ImmutableClass = HigherObjectModule.ImmutableClass;
import ImmutableInstance = HigherObjectModule.ImmutableInstance;

import DatasetModule = require("./datatype/dataset");
import Dataset = DatasetModule.Dataset;

export interface Dummy {}
export var dummyObject: Dummy = {};

export interface ExpressionValue {
  op: string;
  value?: any;
  name?: string;
  lhs?: Expression;
  rhs?: Expression;
  operand?: Expression;
  operands?: Expression[];
  actions?: Action[];
  regexp?: string;
}

export interface ExpressionJS {
  op: string;
  value?: any;
  name?: string;
  lhs?: ExpressionJS;
  rhs?: ExpressionJS;
  operand?: ExpressionJS;
  operands?: ExpressionJS[];
  actions?: ActionJS[];
  regexp?: string;
}

// =====================================================================================
// =====================================================================================

var check: ImmutableClass<ExpressionValue, ExpressionJS>;
export class Expression implements ImmutableInstance<ExpressionValue, ExpressionJS> {
  static isExpression(candidate: any): boolean {
    return isInstanceOf(candidate, Expression);
  }

  static facet(input: any = null): Expression {
    var expressionJS: ExpressionJS;
    if (input) {
      if (typeof input === 'string') {
        expressionJS = {
          op: 'ref',
          name: input
        };
      } else {
        expressionJS = {
          op: 'literal',
          value: input
        };
      }
    } else {
      expressionJS = {
        op: 'literal',
        value: Dataset.fromJS({ dataset: 'base', data: [{}] })
      };
    }
    return Expression.fromJS(expressionJS);
  }

  static fromJSLoose(param: any): Expression {
    var expressionJS: ExpressionJS;
    // Quick parse simple expressions
    switch (typeof param) {
      case 'object':
        expressionJS = <ExpressionJS>param;
        break;

      case 'number':
        expressionJS = { op: 'literal', value: param };
        break;

      case 'string':
        if (param[0] === '$') {
          expressionJS = { op: 'ref', name: param.substring(1) };
        } else {
          expressionJS = { op: 'literal', value: param };
        }
        break;

      default:
        throw new Error("unrecognizable expression");
    }

    return Expression.fromJS(expressionJS);
  }

  static classMap: Lookup<typeof Expression> = {};
  static fromJS(expressionJS: ExpressionJS): Expression {
    if (!expressionJS.hasOwnProperty("op")) {
      throw new Error("op must be defined");
    }
    var op = expressionJS.op;
    if (typeof op !== "string") {
      throw new Error("op must be a string");
    }
    var ClassFn = Expression.classMap[op];
    if (!ClassFn) {
      throw new Error("unsupported expression op '" + op + "'");
    }

    return ClassFn.fromJS(expressionJS);
  }

  public op: string;
  public type: string;

  constructor(parameters: ExpressionValue, dummy: Dummy = null) {
    this.op = parameters.op;
    if (dummy !== dummyObject) {
      throw new TypeError("can not call `new Expression` directly use Expression.fromJS instead");
    }
  }

  protected _ensureOp(op: string) {
    if (!this.op) {
      this.op = op;
      return;
    }
    if (this.op !== op) {
      throw new TypeError("incorrect expression op '" + this.op + "' (needs to be: '" + op + "')");
    }
  }

  public valueOf(): ExpressionValue {
    return {
      op: this.op
    };
  }

  public toJS(): ExpressionJS {
    return {
      op: this.op
    };
  }

  public toJSON(): ExpressionJS {
    return this.toJS();
  }

  public equals(other: Expression): boolean {
    return Expression.isExpression(other) &&
      this.op === other.op;
  }

  public getComplexity(): number {
    return 1;
  }

  public simplify(): Expression {
    return this;
  }

  public getFn(): Function {
    throw new Error('should never be called directly');
  }

  /* protected */
  public _getRawFnJS(): string {
    throw new Error('should never be called directly');
  }

  public getFnJS(wrap: boolean = true) {
    var rawFnJS = this._getRawFnJS();
    if (wrap) {
      return 'function(d){return ' + rawFnJS + ';}';
    } else {
      return rawFnJS;
    }
  }

  protected _performAction(action: Action): Expression {
    return new ActionsExpression({
      op: 'action',
      operand: this,
      actions: [action]
    });
  }

  public apply(name: string, ex: any): Expression {
    if (!Expression.isExpression(ex)) ex = Expression.fromJSLoose(ex);
    return this._performAction(new ApplyAction({ name: name, expression: ex }))
  }

  public filter(ex: any): Expression {
    if (!Expression.isExpression(ex)) ex = Expression.fromJSLoose(ex);
    return this._performAction(new FilterAction({ expression: ex }))
  }

  public sort(ex: any, direction: string): Expression {
    if (!Expression.isExpression(ex)) ex = Expression.fromJSLoose(ex);
    return this._performAction(new SortAction({ expression: ex, direction: direction }))
  }

  public limit(limit: number): Expression {
    return this._performAction(new LimitAction({ limit: limit }))
  }
}
check = Expression;

// =====================================================================================
// =====================================================================================

export class UnaryExpression extends Expression {
  static jsToValue(parameters: ExpressionJS): ExpressionValue {
    var value: ExpressionValue = {
      op: parameters.op
    };
    if (parameters.operand) {
      value.operand = Expression.fromJSLoose(parameters.operand);
    } else {
      throw new TypeError("must have a operand");
    }

    return value;
  }

  public operand: Expression;

  constructor(parameters: ExpressionValue, dummyObject: Dummy) {
    super(parameters, dummyObject);
    this.operand = parameters.operand;
  }

  public valueOf(): ExpressionValue {
    var value = super.valueOf();
    value.operand = this.operand;
    return value;
  }

  public toJS(): ExpressionJS {
    var js: ExpressionJS = super.toJS();
    js.operand = this.operand.toJS();
    return js;
  }

  public equals(other: UnaryExpression): boolean {
    return super.equals(other) &&
      this.operand.equals(other.operand)
  }

  public getComplexity(): number {
    return 1 + this.operand.getComplexity()
  }

  public simplify(): Expression {
    var simplifiedOperand = this.operand.simplify();

    if (simplifiedOperand.op === 'literal') {
      return new LiteralExpression({
        op: 'literal',
        value: this._makeFn(simplifiedOperand.getFn())()
      })
    }

    return new (Expression.classMap[this.op])({
      op: this.op,
      operand: simplifiedOperand
    })
  }

  protected _makeFn(operandFn: Function): Function {
    throw new Error("should never be called directly");
  }

  public getFn(): Function {
    return this._makeFn(this.operand.getFn());
  }

  protected _makeFnJS(operandFnJS: string): string {
    throw new Error("should never be called directly");
  }

  /* protected */
  public _getRawFnJS(): string {
    return this._makeFnJS(this.operand._getRawFnJS())
  }
}

// =====================================================================================
// =====================================================================================

export class BinaryExpression extends Expression {
  static jsToValue(parameters: ExpressionJS): ExpressionValue {
    var op = parameters.op;
    var value: ExpressionValue = {
      op: op
    };
    if (parameters.lhs) {
      value.lhs = Expression.fromJSLoose(parameters.lhs);
    } else {
      throw new TypeError("must have a lhs");
    }

    if (parameters.rhs) {
      value.rhs = Expression.fromJSLoose(parameters.rhs);
    } else {
      throw new TypeError("must have a rhs");
    }

    return value;
  }

  public lhs: Expression;
  public rhs: Expression;

  protected simple: boolean;

  constructor(parameters: ExpressionValue, dummyObject: Dummy) {
    super(parameters, dummyObject);
    this.lhs = parameters.lhs;
    this.rhs = parameters.rhs;
  }

  public valueOf(): ExpressionValue {
    var value = super.valueOf();
    value.lhs = this.lhs;
    value.rhs = this.rhs;
    return value;
  }

  public toJS(): ExpressionJS {
    var js = super.toJS();
    js.lhs = this.lhs.toJS();
    js.rhs = this.rhs.toJS();
    return js;
  }

  public equals(other: BinaryExpression): boolean {
    return super.equals(other) &&
      this.lhs.equals(other.lhs) &&
      this.rhs.equals(other.rhs)
  }

  public getComplexity(): number {
    return 1 + this.lhs.getComplexity() + this.rhs.getComplexity()
  }

  public simplify(): Expression {
    var simplifiedLhs = this.lhs.simplify();
    var simplifiedRhs = this.rhs.simplify();

    if (simplifiedLhs.op === 'literal' && simplifiedRhs.op === 'literal') {
      return new LiteralExpression({
        op: 'literal',
        value: this._makeFn(simplifiedLhs.getFn(), simplifiedRhs.getFn())()
      })
    }

    return new (Expression.classMap[this.op])({
      op: this.op,
      lhs: simplifiedLhs,
      rhs: simplifiedRhs
    })
  }

  protected _makeFn(lhsFn: Function, rhsFn: Function): Function {
    throw new Error("should never be called directly");
  }

  public getFn(): Function {
    return this._makeFn(this.lhs.getFn(), this.rhs.getFn());
  }

  protected _makeFnJS(lhsFnJS: string, rhsFnJS: string): string {
    throw new Error("should never be called directly");
  }

  /* protected */
  public _getRawFnJS(): string {
    return this._makeFnJS(this.lhs._getRawFnJS(), this.rhs._getRawFnJS())
  }
}

// =====================================================================================
// =====================================================================================


export class NaryExpression extends Expression {
  static jsToValue(parameters: ExpressionJS): ExpressionValue {
    var op = parameters.op;
    var value: ExpressionValue = {
      op: op
    };
    if (Array.isArray(parameters.operands)) {
      value.operands = parameters.operands.map((operand) => Expression.fromJSLoose(operand));
    } else {
      throw new TypeError("must have a operands");
    }

    return value;
  }

  public operands: Expression[];

  constructor(parameters: ExpressionValue, dummyObject: Dummy) {
    super(parameters, dummyObject);
    this.operands = parameters.operands;
  }

  public valueOf(): ExpressionValue {
    var value = super.valueOf();
    value.operands = this.operands;
    return value;
  }

  public toJS(): ExpressionJS {
    var js = super.toJS();
    js.operands = this.operands.map((operand) => operand.toJS());
    return js;
  }

  public equals(other: NaryExpression): boolean {
    if (!(super.equals(other) && this.operands.length === other.operands.length)) return false;
    var thisOperands = this.operands;
    var otherOperands = other.operands;
    for (var i = 0; i < thisOperands.length; i++) {
      if (!thisOperands[i].equals(otherOperands[i])) return false;
    }
    return true;
  }

  public getComplexity(): number {
    var complexity = 1;
    var operands = this.operands;
    for (var i = 0; i < operands.length; i++) {
      complexity += operands[i].getComplexity();
    }
    return complexity;
  }

  protected _makeFn(operandFns: Function[]): Function {
    throw new Error("should never be called directly");
  }

  public getFn(): Function {
    return this._makeFn(this.operands.map((operand) => operand.getFn()));
  }

  protected _makeFnJS(operandFnJSs: string[]): string {
    throw new Error("should never be called directly");
  }

  /* protected */
  public _getRawFnJS(): string {
    return this._makeFnJS(this.operands.map((operand) => operand._getRawFnJS()));
  }
}

// =====================================================================================
// =====================================================================================


export class LiteralExpression extends Expression {
  static fromJS(parameters: ExpressionJS): Expression {
    return new LiteralExpression(<ExpressionValue>parameters);
  }

  public value: any;

  constructor(parameters: ExpressionValue) {
    super(parameters, dummyObject);
    this.value = parameters.value;
    this._ensureOp("literal");
    if (typeof this.value === 'undefined') {
      throw new TypeError("must have a `value`")
    }
    var typeofValue = typeof this.value;
    if (typeofValue === 'object') {
      // ToDo: add this
    } else {
      this.type = typeofValue.toUpperCase();
    }
  }

  public valueOf(): ExpressionValue {
    var value = super.valueOf();
    value.value = this.value;
    return value;
  }

  public toJS(): ExpressionJS {
    var js = super.toJS();
    js.value = this.value;
    return js;
  }

  public toString(): string {
    return String(this.value);
  }

  public equals(other: LiteralExpression): boolean {
    return super.equals(other) &&
      this.value === other.value;
  }

  public getFn(): Function {
    var value = this.value;
    return () => value;
  }

  public _getRawFnJS(): string {
    return JSON.stringify(this.value); // ToDo: what to do with higher objects?
  }
}

Expression.classMap["literal"] = LiteralExpression;

// =====================================================================================
// =====================================================================================


export class RefExpression extends Expression {
  static fromJS(parameters: ExpressionJS): RefExpression {
    return new RefExpression(<ExpressionValue>parameters);
  }

  public generations: string;
  public name: string;

  constructor(parameters: ExpressionValue) {
    super(parameters, dummyObject);

    var match = parameters.name.match(/^(\^*)([a-z_]\w*)$/i);
    if (match) {
      this.generations = match[1];
      this.name = match[2];
    } else {
      throw new Error("invalid name '" + parameters.name + "'");
    }
    this._ensureOp("ref");
    if (typeof this.name !== 'string' || this.name.length === 0) {
      throw new TypeError("must have a nonempty `name`");
    }
  }

  public valueOf(): ExpressionValue {
    var value = super.valueOf();
    value.name = this.generations + this.name;
    return value;
  }

  public toJS(): ExpressionJS {
    var js = super.toJS();
    js.name = this.generations + this.name;
    return js;
  }

  public toString(): string {
    return '$' + this.generations + this.name;
  }

  public equals(other: RefExpression): boolean {
    return super.equals(other) &&
      this.name === other.name &&
      this.generations === other.generations;
  }

  public getFn(): Function {
    var len = this.generations.length;
    var name = this.name;
    return (d: any) => {
      for (var i = 0; i < len; i++) d = Object.getPrototypeOf(d);
      return d[name];
    }
  }

  public _getRawFnJS(): string {
    var gen = this.generations;
    return gen.replace(/\^/g, "Object.getPrototypeOf(") + 'd.' + this.name + gen.replace(/\^/g, ")");
  }
}

Expression.classMap["ref"] = RefExpression;

// =====================================================================================
// =====================================================================================


export class IsExpression extends BinaryExpression {
  static fromJS(parameters: ExpressionJS): IsExpression {
    return new IsExpression(BinaryExpression.jsToValue(parameters));
  }

  constructor(parameters: ExpressionValue) {
    super(parameters, dummyObject);
    this._ensureOp("is");
    this.type = 'BOOLEAN';
  }

  public toString(): string {
    return this.lhs.toString() + ' = ' + this.rhs.toString();
  }

  public getComplexity(): number {
    return 1 + this.lhs.getComplexity() + this.rhs.getComplexity();
  }

  protected _makeFn(lhsFn: Function, rhsFn: Function): Function {
    return (d: any) => lhsFn(d) === rhsFn(d);
  }

  protected _makeFnJS(lhsFnJS: string, rhsFnJS: string): string {
    return '(' + lhsFnJS + '===' + rhsFnJS + ')';
  }

  // BINARY
}

Expression.classMap["is"] = IsExpression;
// =====================================================================================
// =====================================================================================


export class LessThanExpression extends BinaryExpression {
  static fromJS(parameters: ExpressionJS): LessThanExpression {
    return new LessThanExpression(BinaryExpression.jsToValue(parameters));
  }

  constructor(parameters: ExpressionValue) {
    super(parameters, dummyObject);
    this._ensureOp("lessThan");
    this.type = 'BOOLEAN';
  }

  public toString(): string {
    return this.lhs.toString() + ' < ' + this.rhs.toString();
  }

  protected _makeFn(lhsFn: Function, rhsFn: Function): Function {
    return (d: any) => lhsFn(d) < rhsFn(d);
  }

  protected _makeFnJS(lhsFnJS: string, rhsFnJS: string): string {
    return '(' + lhsFnJS + '<' + rhsFnJS + ')';
  }

  // BINARY
}

Expression.classMap["lessThan"] = LessThanExpression;
// =====================================================================================
// =====================================================================================


export class LessThanOrEqualExpression extends BinaryExpression {
  static fromJS(parameters: ExpressionJS): LessThanOrEqualExpression {
    return new LessThanOrEqualExpression(BinaryExpression.jsToValue(parameters));
  }

  constructor(parameters: ExpressionValue) {
    super(parameters, dummyObject);
    this._ensureOp("lessThanOrEqual");
    this.type = 'BOOLEAN';
  }

  public toString(): string {
    return this.lhs.toString() + ' <= ' + this.rhs.toString();
  }

  protected _makeFn(lhsFn: Function, rhsFn: Function): Function {
    return (d: any) => lhsFn(d) <= rhsFn(d);
  }

  protected _makeFnJS(lhsFnJS: string, rhsFnJS: string): string {
    return '(' + lhsFnJS + '<=' + rhsFnJS + ')';
  }

  // BINARY
}

Expression.classMap["lessThanOrEqual"] = LessThanOrEqualExpression;
// =====================================================================================
// =====================================================================================


export class GreaterThanExpression extends BinaryExpression {
  static fromJS(parameters: ExpressionJS): GreaterThanExpression {
    return new GreaterThanExpression(BinaryExpression.jsToValue(parameters));
  }

  constructor(parameters: ExpressionValue) {
    super(parameters, dummyObject);
    this._ensureOp("greaterThan");
    this.type = 'BOOLEAN';
  }

  public toString(): string {
    return this.lhs.toString() + ' > ' + this.rhs.toString();
  }

  public simplify(): Expression {
    return (new LessThanExpression({
      op: 'lessThan',
      lhs: this.rhs,
      rhs: this.lhs
    })).simplify()
  }

  protected _makeFn(lhsFn: Function, rhsFn: Function): Function {
    return (d: any) => lhsFn(d) > rhsFn(d);
  }

  protected _makeFnJS(lhsFnJS: string, rhsFnJS: string): string {
    throw '(' + lhsFnJS + '>' + rhsFnJS + ')';
  }

  // BINARY
}

Expression.classMap["greaterThan"] = GreaterThanExpression;

// =====================================================================================
// =====================================================================================


export class GreaterThanOrEqualExpression extends BinaryExpression {
  static fromJS(parameters: ExpressionJS): GreaterThanOrEqualExpression {
    return new GreaterThanOrEqualExpression(BinaryExpression.jsToValue(parameters));
  }

  constructor(parameters: ExpressionValue) {
    super(parameters, dummyObject);
    this._ensureOp("greaterThanOrEqual");
    this.type = 'BOOLEAN';
  }

  public toString(): string {
    return this.lhs.toString() + ' = ' + this.rhs.toString();
  }

  public simplify(): Expression {
    return (new LessThanOrEqualExpression({
      op: 'lessThanOrEqual',
      lhs: this.rhs,
      rhs: this.lhs
    })).simplify()
  }

  protected _makeFn(lhsFn: Function, rhsFn: Function): Function {
    return (d: any) => lhsFn(d) >= rhsFn(d);
  }

  protected _makeFnJS(lhsFnJS: string, rhsFnJS: string): string {
    throw '(' + lhsFnJS + '>=' + rhsFnJS + ')';
  }

  // BINARY
}

Expression.classMap["greaterThanOrEqual"] = GreaterThanOrEqualExpression;

// =====================================================================================
// =====================================================================================


export class InExpression extends BinaryExpression {
  static fromJS(parameters: ExpressionJS): InExpression {
    return new InExpression(BinaryExpression.jsToValue(parameters));
  }

  constructor(parameters: ExpressionValue) {
    super(parameters, dummyObject);
    this._ensureOp("in");
    this.type = 'BOOLEAN';
  }

  public toString(): string {
    return this.lhs.toString() + ' = ' + this.rhs.toString();
  }

  protected _makeFn(lhsFn: Function, rhsFn: Function): Function {
    return (d: any) => rhsFn(d).indexOf(lhsFn(d)) > -1;
  }

  protected _makeFnJS(lhsFnJS: string, rhsFnJS: string): string {
    throw new Error("implement me!");
  }

  // BINARY
}

Expression.classMap["in"] = InExpression;

// =====================================================================================
// =====================================================================================


export class RegexpExpression extends UnaryExpression {
  static fromJS(parameters: ExpressionJS): RegexpExpression {
    var value = UnaryExpression.jsToValue(parameters);
    value.regexp = parameters.regexp;
    return new RegexpExpression(value);
  }

  public regexp: string;

  constructor(parameters: ExpressionValue) {
    super(parameters, dummyObject);
    this.regexp = parameters.regexp;
    this._ensureOp("regexp");
    this.type = 'BOOLEAN';
  }

  public valueOf(): ExpressionValue {
    var value = super.valueOf();
    value.regexp = this.regexp;
    return value;
  }

  public toJS(): ExpressionJS {
    var js = super.toJS();
    js.regexp = this.regexp;
    return js;
  }

  public toString(): string {
    return 'regexp(' + this.operand.toString() + ', /' + this.regexp + '/)';
  }

  protected _makeFn(operandFn: Function): Function {
    var re = new RegExp(this.regexp);
    return (d: any) => re.test(operandFn(d));
  }

  protected _makeFnJS(operandFnJS: string): string {
    return "/" + this.regexp + "/.test(" + operandFnJS + ")";
  }

  // UNARY
}

Expression.classMap["regexp"] = RegexpExpression;

// =====================================================================================
// =====================================================================================

export class NotExpression extends UnaryExpression {
  static fromJS(parameters: ExpressionJS): NotExpression {
    return new NotExpression(UnaryExpression.jsToValue(parameters));
  }

  constructor(parameters: ExpressionValue) {
    super(parameters, dummyObject);
    this._ensureOp("not");
    this.type = 'BOOLEAN';
  }

  public toString(): string {
    return 'not(' + this.operand.toString() + ')';
  }

  public simplify(): Expression {
    return this
  }

  protected _makeFn(operandFn: Function): Function {
    return (d: any) => !operandFn(d);
  }

  protected _makeFnJS(operandFnJS: string): string {
    return "!(" + operandFnJS + ")"
  }

  // UNARY
}

Expression.classMap["not"] = NotExpression;
// =====================================================================================
// =====================================================================================


export class AndExpression extends NaryExpression {
  static fromJS(parameters: ExpressionJS): AndExpression {
    return new AndExpression(NaryExpression.jsToValue(parameters));
  }

  constructor(parameters: ExpressionValue) {
    super(parameters, dummyObject);
    this._ensureOp("and");
    this.type = 'BOOLEAN';
  }

  public toString(): string {
    return 'and(' + this.operands.map((operand) => operand.toString()) + ')';
  }

  public simplify(): Expression {
    return this
  }

  protected _makeFn(operandFns: Function[]): Function {
    throw new Error("should never be called directly");
  }

  protected _makeFnJS(operandFnJSs: string[]): string {
    throw new Error("should never be called directly");
  }

  // NARY
}

Expression.classMap["and"] = AndExpression;

// =====================================================================================
// =====================================================================================

export class OrExpression extends NaryExpression {
  static fromJS(parameters: ExpressionJS): OrExpression {
    return new OrExpression(NaryExpression.jsToValue(parameters));
  }

  constructor(parameters: ExpressionValue) {
    super(parameters, dummyObject);
    this._ensureOp("or");
    this.type = 'BOOLEAN';
  }

  public toString(): string {
    return '(' + this.operands.map((operand) => operand.toString()).join('or') + ')';
  }

  public simplify(): Expression {
    return this
  }

  protected _makeFn(operandFns: Function[]): Function {
    throw new Error("should never be called directly");
  }

  protected _makeFnJS(operandFnJSs: string[]): string {
    throw new Error("should never be called directly");
  }

  // NARY
}

Expression.classMap["or"] = OrExpression;

// =====================================================================================
// =====================================================================================

export class AddExpression extends NaryExpression {
  static fromJS(parameters: ExpressionJS): AddExpression {
    return new AddExpression(NaryExpression.jsToValue(parameters));
  }

  constructor(parameters: ExpressionValue) {
    super(parameters, dummyObject);
    this._ensureOp("add");
    this.type = 'NUMBER';
  }

  public toString(): string {
    return 'add(' + this.operands.map((operand) => operand.toString()) + ')';
  }

  public simplify(): Expression {
    var newOperands: Expression[] = [];
    var literalValue: number = 0;
    for (var i = 0; i < this.operands.length; i++) {
      var simplifiedOperand: Expression = this.operands[i].simplify();
      if (simplifiedOperand.op === 'literal') {
        literalValue += (<LiteralExpression>simplifiedOperand).value;
      } else {
        newOperands.push(simplifiedOperand);
      }
    }

    if (newOperands.length === 0) {
      return new LiteralExpression({ op: 'literal', value: literalValue });
    } else {
      if (literalValue) {
        newOperands.push(new LiteralExpression({ op: 'literal', value: literalValue }));
      }
      return new AddExpression({
        op: 'add',
        operands: newOperands
      })
    }
  }

  protected _makeFn(operandFns: Function[]): Function {
    return (d: any) => {
      var sum = 0;
      for (var i = 0; i < operandFns.length; i++) {
        sum += operandFns[i](d);
      }
      return sum;
    }
  }

  protected _makeFnJS(operandFnJSs: string[]): string {
    return '(' + operandFnJSs.join('+')  + ')';
  }

  // NARY
}

Expression.classMap["add"] = AddExpression;
// =====================================================================================
// =====================================================================================


export class SubtractExpression extends NaryExpression {
  static fromJS(parameters: ExpressionJS): SubtractExpression {
    return new SubtractExpression(NaryExpression.jsToValue(parameters));
  }

  constructor(parameters: ExpressionValue) {
    super(parameters, dummyObject);
    this._ensureOp("subtract");
    this.type = 'NUMBER';
  }

  public toString(): string {
    return 'subtract(' + this.operands.map((operand) => operand.toString()) + ')';
  }

  public simplify(): Expression {
    return this
  }

  protected _makeFn(operandFns: Function[]): Function {
    throw new Error("should never be called directly");
  }

  protected _makeFnJS(operandFnJSs: string[]): string {
    throw new Error("should never be called directly");
  }

  // NARY
}

Expression.classMap["subtract"] = SubtractExpression;

// =====================================================================================
// =====================================================================================


export class MultiplyExpression extends NaryExpression {
  static fromJS(parameters: ExpressionJS): MultiplyExpression {
    return new MultiplyExpression(NaryExpression.jsToValue(parameters));
  }

  constructor(parameters: ExpressionValue) {
    super(parameters, dummyObject);
    this._ensureOp("multiply");
    this.type = 'NUMBER';
  }

  public toString(): string {
    return 'multiply(' + this.operands.map((operand) => operand.toString()) + ')';
  }

  public simplify(): Expression {
    return this
  }

  protected _makeFn(operandFns: Function[]): Function {
    throw new Error("should never be called directly");
  }

  protected _makeFnJS(operandFnJSs: string[]): string {
    throw new Error("should never be called directly");
  }

  // NARY
}

Expression.classMap["multiply"] = MultiplyExpression;

// =====================================================================================
// =====================================================================================


export class DivideExpression extends NaryExpression {
  static fromJS(parameters: ExpressionJS): DivideExpression {
    return new DivideExpression(NaryExpression.jsToValue(parameters));
  }

  constructor(parameters: ExpressionValue) {
    super(parameters, dummyObject);
    this._ensureOp("divide");
    this.type = 'NUMBER';
  }

  public toString(): string {
    return 'divide(' + this.operands.map((operand) => operand.toString()) + ')';
  }

  public simplify(): Expression {
    return this
  }

  protected _makeFn(operandFns: Function[]): Function {
    throw new Error("should never be called directly");
  }

  protected _makeFnJS(operandFnJSs: string[]): string {
    throw new Error("should never be called directly");
  }

  // NARY
}

Expression.classMap["divide"] = DivideExpression;

// =====================================================================================
// =====================================================================================

export class AggregateExpression extends UnaryExpression {
  static fromJS(parameters: ExpressionJS): AggregateExpression {
    return new AggregateExpression(UnaryExpression.jsToValue(parameters));
  }

  constructor(parameters: ExpressionValue) {
    super(parameters, dummyObject);
    this._ensureOp("aggregate");
    this.type = 'NUMBER';
  }

  public toString(): string {
    return 'aggregate(' + this.operand.toString() + ')';
  }

  public simplify(): Expression {
    return this
  }

  protected _makeFn(operandFn: Function): Function {
    throw new Error("implement me");
  }

  protected _makeFnJS(operandFnJS: string): string {
    throw new Error("implement me");
  }

  // UNARY
}

Expression.classMap["aggregate"] = AggregateExpression;

// =====================================================================================
// =====================================================================================

export class OffsetExpression extends UnaryExpression {
  static fromJS(parameters: ExpressionJS): OffsetExpression {
    return new OffsetExpression(UnaryExpression.jsToValue(parameters));
  }

  constructor(parameters: ExpressionValue) {
    super(parameters, dummyObject);
    this._ensureOp("offset");
    this.type = 'TIME';
  }

  public toString(): string {
    return 'offset(' + this.operand.toString() + ')';
  }

  public simplify(): Expression {
    return this
  }

  protected _makeFn(operandFn: Function): Function {
    throw new Error("implement me");
  }

  protected _makeFnJS(operandFnJS: string): string {
    throw new Error("implement me");
  }

  // UNARY
}

Expression.classMap["offset"] = OffsetExpression;

// =====================================================================================
// =====================================================================================

export class ConcatExpression extends NaryExpression {
  static fromJS(parameters: ExpressionJS): ConcatExpression {
    return new ConcatExpression(NaryExpression.jsToValue(parameters));
  }

  constructor(parameters: ExpressionValue) {
    super(parameters, dummyObject);
    this._ensureOp("concat");
    this.type = 'STRING';
  }

  public toString(): string {
    return 'concat(' + this.operands.map((operand) => operand.toString()) + ')';
  }

  public simplify(): Expression {
    return this
  }

  protected _makeFn(operandFns: Function[]): Function {
    throw new Error("should never be called directly");
  }

  protected _makeFnJS(operandFnJSs: string[]): string {
    throw new Error("should never be called directly");
  }

  // NARY
}

Expression.classMap["concat"] = ConcatExpression;

// =====================================================================================
// =====================================================================================


export class RangeExpression extends BinaryExpression {
  static fromJS(parameters: ExpressionJS): RangeExpression {
    return new RangeExpression(BinaryExpression.jsToValue(parameters));
  }

  constructor(parameters: ExpressionValue) {
    super(parameters, dummyObject);
    this._ensureOp("range");
  }

  public toString(): string {
    return this.lhs.toString() + ' = ' + this.rhs.toString();
  }

  protected _makeFn(lhsFn: Function, rhsFn: Function): Function {
    return (d: any) => lhsFn(d) === rhsFn(d);
  }

  protected _makeFnJS(lhsFnJS: string, rhsFnJS: string): string {
    throw new Error("implement me!");
  }

  // BINARY
}

Expression.classMap["range"] = RangeExpression;

// =====================================================================================
// =====================================================================================


export class BucketExpression extends UnaryExpression {
  static fromJS(parameters: ExpressionJS): BucketExpression {
    return new BucketExpression(UnaryExpression.jsToValue(parameters));
  }

  constructor(parameters: ExpressionValue) {
    super(parameters, dummyObject);
    this._ensureOp("bucket");
  }

  public toString(): string {
    return 'bucket(' + this.operand.toString() + ')';
  }

  public simplify(): Expression {
    return this
  }

  protected _makeFn(operandFn: Function): Function {
    throw new Error("implement me");
  }

  protected _makeFnJS(operandFnJS: string): string {
    throw new Error("implement me");
  }

  // UNARY
}

Expression.classMap["bucket"] = BucketExpression;

// =====================================================================================
// =====================================================================================


export class SplitExpression extends UnaryExpression {
  static fromJS(parameters: ExpressionJS): SplitExpression {
    return new SplitExpression(UnaryExpression.jsToValue(parameters));
  }

  constructor(parameters: ExpressionValue) {
    super(parameters, dummyObject);
    this._ensureOp("split");
  }

  public toString(): string {
    return 'split(' + this.operand.toString() + ')';
  }

  public simplify(): Expression {
    return this
  }

  protected _makeFn(operandFn: Function): Function {
    throw new Error("implement me");
  }

  protected _makeFnJS(operandFnJS: string): string {
    throw new Error("implement me");
  }

  // UNARY
}

Expression.classMap["split"] = SplitExpression;

// =====================================================================================
// =====================================================================================

export class ActionsExpression extends UnaryExpression {
  static fromJS(parameters: ExpressionJS): ActionsExpression {
    var value = UnaryExpression.jsToValue(parameters);
    value.actions = parameters.actions.map(Action.fromJS);
    return new ActionsExpression(value);
  }

  public actions: Action[];

  constructor(parameters: ExpressionValue) {
    super(parameters, dummyObject);
    this.actions = parameters.actions;
    this._ensureOp("actions");
    this.type = 'DATASET';
  }

  public valueOf(): ExpressionValue {
    var value = super.valueOf();
    value.actions = this.actions;
    return value;
  }

  public toJS(): ExpressionJS {
    var js = super.toJS();
    js.actions = this.actions.map((action) => action.toJS());
    return js;
  }

  public toString(): string {
    return 'actions(' + this.operand.toString() + ')';
  }

  public simplify(): Expression {
    return this
  }

  protected _makeFn(operandFn: Function): Function {
    throw new Error("implement me");
  }

  protected _makeFnJS(operandFnJS: string): string {
    throw new Error("implement me");
  }

  protected _performAction(action: Action): Expression {
    return new ActionsExpression({
      op: 'actions',
      operand: this.operand,
      actions: this.actions.concat(action)
    });
  }

  // UNARY
}

Expression.classMap["actions"] = ActionsExpression;

// =====================================================================================
// =====================================================================================

export interface ActionValue {
  action?: string;
  name?: string;
  expression?: Expression;
  direction?: string;
  limit?: number;
}

export interface ActionJS {
  action?: string;
  name?: string;
  expression?: ExpressionJS;
  direction?: string;
  limit?: number;
}

// =====================================================================================
// =====================================================================================

var checkAction: ImmutableClass<ActionValue, ActionJS>;
export class Action implements ImmutableInstance<ActionValue, ActionJS> {
  static isAction(candidate: any): boolean {
    return isInstanceOf(candidate, Action);
  }

  static classMap: Lookup<typeof Action> = {};
  static fromJS(actionJS: ActionJS): Action {
    if (!actionJS.hasOwnProperty("action")) {
      throw new Error("action must be defined");
    }
    var action = actionJS.action;
    if (typeof action !== "string") {
      throw new Error("action must be a string");
    }
    var ClassFn = Action.classMap[action];
    if (!ClassFn) {
      throw new Error("unsupported action '" + action + "'");
    }

    return ClassFn.fromJS(actionJS);
  }

  public action: string;
  public expression: Expression;

  constructor(parameters: ActionValue, dummy: Dummy = null) {
    this.action = parameters.action;
    this.expression = parameters.expression;
    if (dummy !== dummyObject) {
      throw new TypeError("can not call `new Action` directly use Action.fromJS instead");
    }
  }

  protected _ensureAction(action: string) {
    if (!this.action) {
      this.action = action;
      return;
    }
    if (this.action !== action) {
      throw new TypeError("incorrect action '" + this.action + "' (needs to be: '" + action + "')");
    }
  }

  public valueOf(): ActionValue {
    var value: ActionValue = {
      action: this.action
    };
    if (this.expression) {
      value.expression = this.expression;
    }
    return value;
  }

  public toJS(): ActionJS {
    var js: ActionJS = {
      action: this.action
    };
    if (this.expression) {
      js.expression = this.expression.toJS();
    }
    return js;
  }

  public toJSON(): ActionJS {
    return this.toJS();
  }

  public equals(other: Action): boolean {
    return Action.isAction(other) &&
      this.action === other.action
  }

  public getComplexity(): number {
    return 1 + (this.expression ? this.expression.getComplexity() : 0);
  }

  public simplify(): Action {
    return this;
  }
}
checkAction = Action;

// =====================================================================================
// =====================================================================================

export class ApplyAction extends Action {
  static fromJS(parameters: ActionJS): ApplyAction {
    return new ApplyAction({
      action: parameters.action,
      name: parameters.name,
      expression: Expression.fromJS(parameters.expression)
    });
  }

  public name: string;

  constructor(parameters: ActionValue = {}) {
    super(parameters, dummyObject);
    this.name = parameters.name;
    this._ensureAction("apply");
  }

  public valueOf(): ActionValue {
    var value = super.valueOf();
    value.name = this.name;
    return value;
  }

  public toJS(): ActionJS {
    var js = super.toJS();
    js.name = this.name;
    return js;
  }

  public toString(): string {
    return 'Apply(' + this.name + ', ' + this.expression.toString() + ')';
  }

  public equals(other: ApplyAction): boolean {
    return super.equals(other) &&
      this.name === other.name;
  }
}

Action.classMap["apply"] = ApplyAction;

// =====================================================================================
// =====================================================================================

export class FilterAction extends Action {
  static fromJS(parameters: ActionJS): FilterAction {
    return new FilterAction({
      action: parameters.action,
      name: parameters.name,
      expression: Expression.fromJS(parameters.expression)
    });
  }

  constructor(parameters: ActionValue = {}) {
    super(parameters, dummyObject);
    this._ensureAction("filter");
  }

  public toString(): string {
    return 'Filter(' + this.expression.toString() + ')';
  }
}

Action.classMap["filter"] = FilterAction;

// =====================================================================================
// =====================================================================================

export class SortAction extends Action {
  static fromJS(parameters: ActionJS): SortAction {
    return new SortAction({
      action: parameters.action,
      expression: Expression.fromJS(parameters.expression),
      direction: parameters.direction
    });
  }

  public direction: string;

  constructor(parameters: ActionValue = {}) {
    super(parameters, dummyObject);
    this.direction = parameters.direction;
    this._ensureAction("sort");
    if (this.direction !== 'descending' && this.direction !== 'ascending') {
      throw new Error("direction must be 'descending' or 'ascending'");
    }
  }

  public valueOf(): ActionValue {
    var value = super.valueOf();
    value.direction = this.direction;
    return value;
  }

  public toJS(): ActionJS {
    var js = super.toJS();
    js.direction = this.direction;
    return js;
  }

  public toString(): string {
    return 'Sort(' + this.expression.toString() + ', ' + this.direction + ')';
  }

  public equals(other: SortAction): boolean {
    return super.equals(other) &&
      this.direction === other.direction;
  }
}

Action.classMap["sort"] = SortAction;

// =====================================================================================
// =====================================================================================

export class LimitAction extends Action {
  static fromJS(parameters: ActionJS): LimitAction {
    return new LimitAction({
      action: parameters.action,
      limit: parameters.limit
    });
  }

  public limit: number;

  constructor(parameters: ActionValue = {}) {
    super(parameters, dummyObject);
    this.limit = parameters.limit;
    this._ensureAction("limit");
  }

  public valueOf(): ActionValue {
    var value = super.valueOf();
    value.limit = this.limit;
    return value;
  }

  public toJS(): ActionJS {
    var js = super.toJS();
    js.limit = this.limit;
    return js;
  }

  public toString(): string {
    return 'Limit(' + this.limit + ')';
  }

  public equals(other: LimitAction): boolean {
    return super.equals(other) &&
      this.limit === other.limit;
  }
}

Action.classMap["limit"] = LimitAction;
