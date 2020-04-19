import { getCustomRepository, getRepository } from 'typeorm';
import csvOldParse from 'csv-parse';

import Transaction from '../models/Transaction';
import Category from '../models/Category';

import AppError from '../errors/AppError';

import TransactionsRepository from '../repositories/TransactionsRepository';

function csvParse(
  buffer: Buffer,
  options: csvOldParse.Options,
): Promise<Transaction[]> {
  return new Promise((resolve, reject) => {
    csvOldParse(buffer, options, (err, results) => {
      if (err) reject(err);
      else resolve(results);
    });
  });
}

class ImportTransactionsService {
  async execute(file: Express.Multer.File): Promise<Transaction[]> {
    const transactionRepository = getCustomRepository(TransactionsRepository);
    const categoryRepository = getRepository(Category);

    const transactionFile = await csvParse(file.buffer, {
      columns: true,
      trim: true,
    });

    const values = transactionFile.reduce(
      (value, transaction) =>
        transaction.type === 'income'
          ? value + transaction.value
          : value - transaction.value,
      0,
    );

    const { total } = await transactionRepository.getBalance();

    if (total + values < 0) {
      throw new AppError('Cannot complete transaction, funds below zero');
    }

    const categoryTitlesFromFile = Array.from(
      new Set(transactionFile.map(transaction => transaction.category)),
    );

    const categories = categoryTitlesFromFile.map(async categoryTitle => {
      let transCategory = await categoryRepository.findOne({
        where: { title: categoryTitle },
      });

      if (!transCategory) {
        transCategory = categoryRepository.create({ title: categoryTitle });
        await categoryRepository.save(transCategory);
      }
    });

    await Promise.all(categories);

    const promises = transactionFile.map(async t => {
      const { title, type, value, category } = t;

      const transCategory = await categoryRepository.findOne({
        where: { title: category },
      });

      const transaction = transactionRepository.create({
        title,
        type,
        value,
        category: transCategory?.id,
      });

      await transactionRepository.save(transaction);

      return transaction;
    });

    return Promise.all(promises);
  }
}

export default ImportTransactionsService;
