import { getCustomRepository, getRepository } from 'typeorm';
import AppError from '../errors/AppError';
import Transaction from '../models/Transaction';
import Category from '../models/Category';
import TranscationsRepository from '../repositories/TransactionsRepository';

interface Request {
  title: string;
  value: number;
  type: 'income' | 'outcome';
  category: string;
}

class CreateTransactionService {
  public async execute({
    title,
    value,
    type,
    category,
  }: Request): Promise<Transaction> {
    const transactionRepository = getCustomRepository(TranscationsRepository);

    const categoryRepository = getRepository(Category);

    if (
      type === 'outcome' &&
      (await transactionRepository.getBalance()).total - value < 0
    ) {
      throw new AppError('Cannot complete transaction, funds below zero');
    }

    let transCategory = await categoryRepository.findOne({
      where: { title: category },
    });

    if (!transCategory) {
      transCategory = categoryRepository.create({ title: category });
      await categoryRepository.save(transCategory);
    }

    const transaction = transactionRepository.create({
      title,
      type,
      value,
      category: transCategory.id,
    });

    await transactionRepository.save(transaction);

    return transaction;
  }
}

export default CreateTransactionService;
